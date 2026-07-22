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
const MAX_MESSAGE_BYTES = 10 * 1024 * 1024;
// generous flood protection: the server cannot inspect ciphertext, so cap
// how fast a single connection may push messages AND how many bytes per
// window (normal editing stays far below both; the client fully re-syncs
// on reconnect)
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_MESSAGES = 1000;
const RATE_LIMIT_MAX_BYTES = 25 * 1024 * 1024;
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
}

interface RedisEnvelope {
  serverId: string;
  close?: boolean;
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
          const readOnly = await this.authenticate(msg.token, pageId);
          member = { socket: client, readOnly };
          clearTimeout(authTimer);
          this.join(pageId, member);
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

    client.on('close', () => {
      clearTimeout(authTimer);
      if (member) {
        this.leave(pageId, member);
      }
    });

    client.on('error', () => {
      // close handler performs the cleanup
    });
  }

  /** Verify the collab JWT and the user's access to this encrypted page. */
  private async authenticate(token: string, pageId: string): Promise<boolean> {
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

    return readOnly;
  }

  private join(pageId: string, member: RelayMember): void {
    let room = this.rooms.get(pageId);
    if (!room) {
      room = new Set();
      this.rooms.set(pageId, room);
      this.sub?.subscribe(this.channelFor(pageId)).catch((err) => {
        this.logger.error(`Failed to subscribe to e2ee room ${pageId}`, err);
      });
    }
    room.add(member);
  }

  private leave(pageId: string, member: RelayMember): void {
    const room = this.rooms.get(pageId);
    if (!room) {
      return;
    }
    room.delete(member);
    if (room.size === 0) {
      this.rooms.delete(pageId);
      this.sub?.unsubscribe(this.channelFor(pageId)).catch(() => {});
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
        this.closeLocalRoom(pageId);
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
   * removed and live encrypted sessions must not linger.
   */
  async closeRoom(pageId: string): Promise<void> {
    this.closeLocalRoom(pageId);
    await this.pub?.publish(
      this.channelFor(pageId),
      JSON.stringify({
        serverId: this.serverId,
        close: true,
      } satisfies RedisEnvelope),
    );
  }

  private closeLocalRoom(pageId: string): void {
    const room = this.rooms.get(pageId);
    if (!room) {
      return;
    }
    for (const member of room) {
      member.socket.close(4410, 'page encryption changed');
    }
    // the sockets' close events remove members; clear eagerly anyway
    this.rooms.delete(pageId);
    this.sub?.unsubscribe(this.channelFor(pageId)).catch(() => {});
  }

  async onModuleDestroy(): Promise<void> {
    for (const pageId of [...this.rooms.keys()]) {
      this.closeLocalRoom(pageId);
    }
    this.pub?.disconnect();
    this.sub?.disconnect();
  }
}
