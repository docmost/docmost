import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import RedisClient from 'ioredis';
import { nanoid } from 'nanoid';
import * as os from 'node:os';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { SpaceRole } from '../../common/helpers/types/permission';
import {
  createRetryStrategy,
  isUserDisabled,
  parseRedisUrl,
} from '../../common/helpers';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { JwtCollabPayload, JwtType } from '../../core/auth/dto/jwt-payload';

const AUTH_TIMEOUT_MS = 10_000;
/**
 * Distinct from the 4401 used for an expired token: the client refreshes its
 * token and reconnects on 4401, which is pointless — and a reconnect loop —
 * when the problem is that access was taken away.
 */
const CLOSE_ACCESS_REVOKED = 4403;
/**
 * The page stopped being an encrypted page (or was deleted): terminal for the
 * client — there is no encrypted room to rejoin.
 */
const CLOSE_ENCRYPTION_CHANGED = 4410;
/**
 * The room was closed but the page is still encrypted and may still be
 * joinable (e.g. it moved to another space, or this node is shutting down).
 * Clients treat this as an ordinary drop and reconnect, which re-runs the
 * full authorization check against the page's new state.
 */
export const CLOSE_REJOIN = 4412;
const MAX_MESSAGE_BYTES = 10 * 1024 * 1024;
// generous flood protection: the server cannot inspect ciphertext, so cap
// how fast a single connection may push messages AND how many bytes per
// window (normal editing stays far below both; the client fully re-syncs
// on reconnect)
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_MESSAGES = 1000;
const RATE_LIMIT_MAX_BYTES = 25 * 1024 * 1024;
// A sync-request makes every other member encode and encrypt the whole
// document, so one cheap message costs the room far more than it costs the
// sender. The initial catch-up is expected; anything beyond this cadence is
// not, and read-only members can send them too.
const SYNC_REQUEST_MIN_INTERVAL_MS = 5_000;
// Half-open sockets never fire 'close', so without a liveness probe rooms grow
// and broadcasts go to peers that will never read them.
const HEARTBEAT_INTERVAL_MS = 30_000;
// how often sessions are swept for an expired token or revoked access; also
// bounds how long a session outlives the access it was granted
const SESSION_SWEEP_INTERVAL_MS = 60_000;
// A tab holds one connection per open encrypted page. The cap is per user, per
// node, and exists so a runaway client cannot exhaust the room.
const MAX_CONNECTIONS_PER_USER = 20;
const MAX_ROOM_MEMBERS = 100;
// message types clients may exchange; payloads are opaque ciphertext that the
// server relays without ever decoding
const RELAYED_TYPES = new Set([
  'update',
  'awareness',
  'sync-request',
  'sync-response',
]);
// types that can alter the document on receiving clients — dropped from
// read-only connections (the server cannot validate ciphertext, but it can
// refuse to relay writes from viewers)
const WRITE_TYPES = new Set(['update', 'sync-response']);

interface RelayMember {
  socket: WebSocket;
  readOnly: boolean;
  userId: string;
  /**
   * When this member's collab token expires, in epoch ms (0 when the token
   * carries no expiry). Authorization is checked once at connect, so this is
   * what bounds how long a session can outlive the access it was granted:
   * the member is closed at expiry and a reconnect re-runs the full check.
   */
  expiresAt: number;
  /** cleared on pong; a member that misses a whole beat is terminated */
  isAlive: boolean;
  lastSyncRequestAt: number;
}

interface AuthResult {
  readOnly: boolean;
  userId: string;
  expiresAt: number;
}

interface RelayAccess {
  canAccess: boolean;
  /** undefined when the check could not be completed — leave the member as is */
  readOnly: boolean | undefined;
}

interface RedisEnvelope {
  serverId: string;
  close?: boolean;
  closeCode?: number;
  data?: string;
}

/**
 * Blind relay for end-to-end encrypted pages. Clients that hold the page DEK
 * exchange encrypted Yjs updates and awareness through per-page rooms; the
 * server only authenticates membership and forwards ciphertext. Rooms are
 * bridged across nodes with Redis pub/sub (one channel per page).
 */
@Injectable()
export class E2eeRelayService implements OnModuleDestroy {
  private readonly logger = new Logger(E2eeRelayService.name);
  private readonly rooms = new Map<string, Set<RelayMember>>();
  private readonly serverId = `e2ee-${os?.hostname()}-${nanoid(10)}`;
  private readonly pub: RedisClient | null = null;
  private readonly sub: RedisClient | null = null;
  /** open connections per user on this node, for MAX_CONNECTIONS_PER_USER */
  private readonly connectionsPerUser = new Map<string, number>();
  /**
   * Serializes subscribe/unsubscribe per channel. A fast leave-then-rejoin
   * issues both, and if the unsubscribe were to land after the new subscribe
   * the room would silently stop receiving other nodes' updates — edits would
   * look lost with nothing reporting an error.
   */
  private readonly channelOps = new Map<string, Promise<void>>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sessionSweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly tokenService: TokenService,
    private readonly userRepo: UserRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly environmentService: EnvironmentService,
  ) {
    if (!this.environmentService.isCollabDisableRedis()) {
      const redisConfig = parseRedisUrl(this.environmentService.getRedisUrl());
      const options = {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        family: redisConfig.family,
        retryStrategy: createRetryStrategy(),
      };
      this.pub = new RedisClient(options);
      this.sub = new RedisClient(options);
      this.sub.on('message', (channel: string, raw: string) =>
        this.onRedisMessage(channel, raw),
      );
    }

    this.heartbeatTimer = setInterval(
      () => this.sweepDeadConnections(),
      HEARTBEAT_INTERVAL_MS,
    );
    this.heartbeatTimer.unref?.();

    this.sessionSweepTimer = setInterval(() => {
      void this.sweepExpiredSessions().catch((err) =>
        this.logger.error('e2ee relay session sweep failed', err),
      );
    }, SESSION_SWEEP_INTERVAL_MS);
    this.sessionSweepTimer.unref?.();
  }

  /**
   * Terminate sockets that did not answer the previous ping, then ping the
   * rest. A half-open connection is dropped within two intervals.
   */
  private sweepDeadConnections(): void {
    for (const room of this.rooms.values()) {
      for (const member of room) {
        if (!member.isAlive) {
          member.socket.terminate();
          continue;
        }
        member.isAlive = false;
        try {
          member.socket.ping();
        } catch {
          member.socket.terminate();
        }
      }
    }
  }

  /**
   * Close members whose collab token has expired, and re-check that everyone
   * still holds the access they joined with.
   *
   * Authorization is otherwise evaluated once, at join. A collab token can live
   * for hours, so without this a member removed from the space — or from a
   * restricted page — would keep receiving the room's ciphertext until their
   * token happened to expire. Checks are deduplicated per user, since a user
   * with several tabs open on a page has the same answer for all of them.
   */
  private async sweepExpiredSessions(): Promise<void> {
    const now = Date.now();
    for (const [pageId, room] of this.rooms) {
      const stillHere: RelayMember[] = [];
      for (const member of room) {
        if (member.expiresAt && member.expiresAt <= now) {
          member.socket.close(4401, 'session expired');
        } else {
          stillHere.push(member);
        }
      }
      if (stillHere.length === 0) continue;

      const verdicts = new Map<string, Promise<RelayAccess>>();
      for (const member of stillHere) {
        if (!verdicts.has(member.userId)) {
          verdicts.set(
            member.userId,
            this.currentAccess(member.userId, pageId),
          );
        }
      }

      await Promise.all(
        stillHere.map(async (member) => {
          const access = await verdicts.get(member.userId);
          if (!access.canAccess) {
            member.socket.close(CLOSE_ACCESS_REVOKED, 'access revoked');
            return;
          }
          // Demotion to read-only is applied in place. Write filtering reads
          // this flag on every frame, so it takes effect immediately without
          // interrupting a session the user is still entitled to watch. Note
          // this only ever restricts: a check that could not be completed
          // leaves the member as it found them rather than granting write
          // rights the last successful check had taken away.
          if (access.readOnly !== undefined) {
            member.readOnly = access.readOnly;
          }
        }),
      );
    }
  }

  /** What this user is entitled to in this page's room, right now. */
  private async currentAccess(
    userId: string,
    pageId: string,
  ): Promise<RelayAccess> {
    try {
      const page = await this.pageRepo.findById(pageId);
      if (!page || !page.isEncrypted) {
        return { canAccess: false, readOnly: true };
      }

      const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
        userId,
        page.spaceId,
      );
      const userSpaceRole = findHighestUserSpaceRole(userSpaceRoles);
      if (!userSpaceRole) {
        return { canAccess: false, readOnly: true };
      }

      const { hasAnyRestriction, canAccess, canEdit } =
        await this.pagePermissionRepo.canUserEditPage(userId, page.id);

      if (hasAnyRestriction) {
        if (!canAccess) return { canAccess: false, readOnly: true };
        return { canAccess: true, readOnly: !canEdit };
      }

      return {
        canAccess: true,
        readOnly: userSpaceRole === SpaceRole.READER || !!page.deletedAt,
      };
    } catch (err) {
      // A failed check must not disconnect a legitimate member — the next
      // sweep tries again and the token expiry is the backstop — but it must
      // not hand back write rights either. `readOnly: undefined` means "no
      // opinion": the caller keeps whatever the member already had.
      this.logger.warn(
        `Failed to revalidate e2ee relay access for page ${pageId}`,
        err,
      );
      return { canAccess: true, readOnly: undefined };
    }
  }

  /** Serialize a subscribe/unsubscribe against others on the same channel. */
  private queueChannelOp(channel: string, op: () => Promise<void>): void {
    const previous = this.channelOps.get(channel) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(op)
      .catch((err) =>
        this.logger.error(`e2ee relay channel op failed for ${channel}`, err),
      );
    this.channelOps.set(channel, next);
    void next.then(() => {
      if (this.channelOps.get(channel) === next) {
        this.channelOps.delete(channel);
      }
    });
  }

  private channelFor(pageId: string): string {
    return `e2ee-room:${pageId}`;
  }

  handleConnection(client: WebSocket, request: IncomingMessage): void {
    let pageId: string | null = null;
    try {
      const url = new URL(request.url ?? '/', 'ws://localhost');
      pageId = url.searchParams.get('pageId');
    } catch {
      // fall through to close below
    }
    if (!pageId) {
      client.close(4400, 'pageId required');
      return;
    }

    let member: RelayMember | null = null;
    let authenticating = false;
    // Set when the socket closes before join completes. Without this, a close
    // during await authenticate leaves member null so leave() never runs, then
    // auth succeeds and join() adds a dead socket that burns room/user caps.
    let closedBeforeJoin = false;
    let rateWindowStart = Date.now();
    let rateWindowCount = 0;
    let rateWindowBytes = 0;
    const authTimer = setTimeout(() => {
      if (!member) {
        client.close(4401, 'authentication timeout');
      }
    }, AUTH_TIMEOUT_MS);

    client.on('message', async (data: Buffer) => {
      if (data.length > MAX_MESSAGE_BYTES) {
        client.close(4413, 'message too large');
        return;
      }
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (!member) {
        if (
          authenticating ||
          msg?.type !== 'auth' ||
          typeof msg.token !== 'string'
        ) {
          if (!authenticating) client.close(4401, 'expected auth message');
          return;
        }
        authenticating = true;
        try {
          const auth = await this.authenticate(msg.token, pageId);
          // Socket may have closed (or timed out) while auth was in flight.
          if (
            closedBeforeJoin ||
            client.readyState !== WebSocket.OPEN
          ) {
            return;
          }
          member = {
            socket: client,
            readOnly: auth.readOnly,
            userId: auth.userId,
            expiresAt: auth.expiresAt,
            isAlive: true,
            lastSyncRequestAt: 0,
          };
          clearTimeout(authTimer);
          if (!this.join(pageId, member)) {
            member = null;
            client.close(4429, 'too many connections');
            return;
          }
          client.send(JSON.stringify({ type: 'ready' }));
        } catch (err) {
          this.logger.debug(
            `e2ee relay auth failed for page ${pageId}: ${err}`,
          );
          client.close(4401, 'unauthorized');
        }
        return;
      }

      const now = Date.now();
      if (now - rateWindowStart > RATE_LIMIT_WINDOW_MS) {
        rateWindowStart = now;
        rateWindowCount = 0;
        rateWindowBytes = 0;
      }
      rateWindowCount += 1;
      rateWindowBytes += data.length;
      if (
        rateWindowCount > RATE_LIMIT_MAX_MESSAGES ||
        rateWindowBytes > RATE_LIMIT_MAX_BYTES
      ) {
        client.close(4429, 'rate limit exceeded');
        return;
      }

      if (!RELAYED_TYPES.has(msg?.type) || typeof msg.payload !== 'string') {
        return;
      }
      if (member.readOnly && WRITE_TYPES.has(msg.type)) {
        return;
      }
      // amplification guard: see SYNC_REQUEST_MIN_INTERVAL_MS
      if (msg.type === 'sync-request') {
        if (now - member.lastSyncRequestAt < SYNC_REQUEST_MIN_INTERVAL_MS) {
          return;
        }
        member.lastSyncRequestAt = now;
      }
      const raw = data.toString();
      this.broadcastLocal(pageId, raw, member);
      this.pub?.publish(
        this.channelFor(pageId),
        JSON.stringify({
          serverId: this.serverId,
          data: raw,
        } satisfies RedisEnvelope),
      );
    });

    client.on('pong', () => {
      if (member) {
        member.isAlive = true;
      }
    });

    client.on('close', () => {
      clearTimeout(authTimer);
      closedBeforeJoin = true;
      if (member) {
        this.leave(pageId, member);
      }
    });

    client.on('error', () => {
      // close handler performs the cleanup
    });
  }

  /** Verify the collab JWT and the user's access to this encrypted page. */
  private async authenticate(
    token: string,
    pageId: string,
  ): Promise<AuthResult> {
    let jwtPayload: JwtCollabPayload;
    try {
      jwtPayload = await this.tokenService.verifyJwt(token, JwtType.COLLAB);
    } catch {
      throw new Error('invalid collab token');
    }

    const user = await this.userRepo.findById(
      jwtPayload.sub,
      jwtPayload.workspaceId,
    );
    if (!user || isUserDisabled(user)) {
      throw new Error('user not found or disabled');
    }

    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      throw new Error('page not found');
    }
    if (page.workspaceId !== jwtPayload.workspaceId) {
      throw new Error('page belongs to another workspace');
    }
    if (!page.isEncrypted) {
      throw new Error('page is not encrypted');
    }

    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      page.spaceId,
    );
    const userSpaceRole = findHighestUserSpaceRole(userSpaceRoles);
    if (!userSpaceRole) {
      throw new Error('user has no access to space');
    }

    let readOnly = false;
    const { hasAnyRestriction, canAccess, canEdit } =
      await this.pagePermissionRepo.canUserEditPage(user.id, page.id);
    if (hasAnyRestriction) {
      if (!canAccess) {
        throw new Error('user has no access to page');
      }
      readOnly = !canEdit;
    } else if (userSpaceRole === SpaceRole.READER) {
      readOnly = true;
    }
    if (page.deletedAt) {
      readOnly = true;
    }

    return {
      readOnly,
      userId: user.id,
      expiresAt: jwtPayload.exp ? jwtPayload.exp * 1000 : 0,
    };
  }

  /** Returns false when a cap is hit and the member was not admitted. */
  private join(pageId: string, member: RelayMember): boolean {
    const userConnections = this.connectionsPerUser.get(member.userId) ?? 0;
    if (userConnections >= MAX_CONNECTIONS_PER_USER) {
      return false;
    }

    let room = this.rooms.get(pageId);
    if (room && room.size >= MAX_ROOM_MEMBERS) {
      return false;
    }
    if (!room) {
      room = new Set();
      this.rooms.set(pageId, room);
      const channel = this.channelFor(pageId);
      this.queueChannelOp(channel, async () => {
        // the room may have emptied again while this was queued
        if (this.rooms.has(pageId)) {
          await this.sub?.subscribe(channel);
        }
      });
    }
    room.add(member);
    this.connectionsPerUser.set(member.userId, userConnections + 1);
    return true;
  }

  private leave(pageId: string, member: RelayMember): void {
    const remaining = (this.connectionsPerUser.get(member.userId) ?? 1) - 1;
    if (remaining > 0) {
      this.connectionsPerUser.set(member.userId, remaining);
    } else {
      this.connectionsPerUser.delete(member.userId);
    }

    const room = this.rooms.get(pageId);
    if (!room) {
      return;
    }
    room.delete(member);
    if (room.size === 0) {
      this.rooms.delete(pageId);
      const channel = this.channelFor(pageId);
      this.queueChannelOp(channel, async () => {
        // someone may have rejoined while this was queued
        if (!this.rooms.has(pageId)) {
          await this.sub?.unsubscribe(channel);
        }
      });
    }
  }

  private broadcastLocal(
    pageId: string,
    raw: string,
    except?: RelayMember,
  ): void {
    const room = this.rooms.get(pageId);
    if (!room) {
      return;
    }
    for (const member of room) {
      if (member === except || member.socket.readyState !== WebSocket.OPEN) {
        continue;
      }
      member.socket.send(raw);
    }
  }

  private onRedisMessage(channel: string, raw: string): void {
    const pageId = channel.slice('e2ee-room:'.length);
    let envelope: RedisEnvelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      return;
    }
    if (envelope.close) {
      if (envelope.serverId !== this.serverId) {
        this.closeLocalRoom(pageId, envelope.closeCode);
      }
      return;
    }
    if (envelope.serverId === this.serverId || !envelope.data) {
      return;
    }
    this.broadcastLocal(pageId, envelope.data);
  }

  /**
   * Force-close the room on every node, e.g. when the page's encryption is
   * removed and live encrypted sessions must not linger. Pass CLOSE_REJOIN
   * when the page remains encrypted and members should reconnect (the rejoin
   * re-runs the full authorization check).
   */
  async closeRoom(
    pageId: string,
    code: number = CLOSE_ENCRYPTION_CHANGED,
  ): Promise<void> {
    this.closeLocalRoom(pageId, code);
    await this.pub?.publish(
      this.channelFor(pageId),
      JSON.stringify({
        serverId: this.serverId,
        close: true,
        closeCode: code,
      } satisfies RedisEnvelope),
    );
  }

  private closeLocalRoom(
    pageId: string,
    code: number = CLOSE_ENCRYPTION_CHANGED,
  ): void {
    const room = this.rooms.get(pageId);
    if (!room) {
      return;
    }
    const reason =
      code === CLOSE_REJOIN ? 'page access changed' : 'page encryption changed';
    for (const member of room) {
      member.socket.close(code, reason);
    }
    // the sockets' close events remove members; clear eagerly anyway
    this.rooms.delete(pageId);
    const channel = this.channelFor(pageId);
    this.queueChannelOp(channel, async () => {
      if (!this.rooms.has(pageId)) {
        await this.sub?.unsubscribe(channel);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.sessionSweepTimer) clearInterval(this.sessionSweepTimer);
    for (const pageId of [...this.rooms.keys()]) {
      // node shutdown, not an encryption change: members reconnect elsewhere
      this.closeLocalRoom(pageId, CLOSE_REJOIN);
    }
    this.pub?.disconnect();
    this.sub?.disconnect();
  }
}
