import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { Server, Socket } from 'socket.io';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { getBaseRoomName } from '../../../ws/ws.utils';
import { BasePresenceService, PresenceEntry } from './base-presence.service';
import { PageAccessService } from '../../page/page-access/page-access.service';

/*
 * Inbound shapes from untrusted socket clients. Zod-validated at the
 * boundary so malformed payloads (non-uuid pageId, missing fields,
 * oversized selection blobs) never reach the permission check or Redis.
 */
const baseSubscribeSchema = z.object({
  operation: z.literal('base:subscribe'),
  pageId: z.uuid(),
});

const baseUnsubscribeSchema = z.object({
  operation: z.literal('base:unsubscribe'),
  pageId: z.uuid(),
});

const basePresenceSchema = z.object({
  operation: z.literal('base:presence'),
  pageId: z.uuid(),
  cellId: z.string().max(200).optional().nullable(),
  selection: z.unknown().optional(),
});

const basePresenceLeaveSchema = z.object({
  operation: z.literal('base:presence:leave'),
  pageId: z.uuid(),
});

const inboundSchema = z.union([
  baseSubscribeSchema,
  baseUnsubscribeSchema,
  basePresenceSchema,
  basePresenceLeaveSchema,
]);

type BaseInbound = z.infer<typeof inboundSchema>;

type BaseOutbound = { operation: `base:${string}` } & Record<string, unknown>;

@Injectable()
export class BaseWsService {
  private readonly logger = new Logger(BaseWsService.name);
  private server: Server | null = null;

  constructor(
    private readonly baseRepo: BaseRepo,
    private readonly userRepo: UserRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly presence: BasePresenceService,
  ) {}

  setServer(server: Server): void {
    this.server = server;
  }

  isBaseEvent(data: any): boolean {
    return (
      typeof data?.operation === 'string' && data.operation.startsWith('base:')
    );
  }

  async handleInbound(client: Socket, raw: unknown): Promise<void> {
    const parsed = inboundSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.debug(
        `Rejecting inbound base event: ${parsed.error.issues[0]?.message}`,
      );
      return;
    }
    const data = parsed.data;
    switch (data.operation) {
      case 'base:subscribe':
        await this.subscribe(client, data.pageId);
        return;
      case 'base:unsubscribe':
        await this.unsubscribe(client, data.pageId);
        return;
      case 'base:presence':
        await this.handlePresence(client, data);
        return;
      case 'base:presence:leave':
        await this.handlePresenceLeave(client, data.pageId);
        return;
    }
  }

  emitToBase(pageId: string, payload: BaseOutbound): void {
    if (!this.server) return;
    this.server.to(getBaseRoomName(pageId)).emit('message', payload);
  }

  /*
   * Called from WsGateway on client disconnect. Walks the per-socket
   * set of subscribed bases and cleans up presence without waiting for
   * entry TTLs to expire — keeps the snapshot fresh for others in the
   * room.
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    const subs = this.subscriptionsFor(client);
    if (!userId || subs.size === 0) return;
    for (const pageId of subs) {
      await this.presence.leave(pageId, userId);
      this.emitToBase(pageId, {
        operation: 'base:presence:leave',
        pageId,
        userId,
      });
    }
    subs.clear();
  }

  private async subscribe(client: Socket, pageId: string): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    const workspaceId = client.data?.workspaceId as string | undefined;
    if (!userId || !workspaceId) {
      client.emit('message', {
        operation: 'base:subscribe:error',
        pageId,
        reason: 'unauthenticated',
      });
      return;
    }

    const base = await this.baseRepo.findById(pageId);
    if (!base) {
      client.emit('message', {
        operation: 'base:subscribe:error',
        pageId,
        reason: 'not_found',
      });
      return;
    }

    const canRead = await this.canReadBase(userId, workspaceId, base);
    if (!canRead) {
      client.emit('message', {
        operation: 'base:subscribe:error',
        pageId,
        reason: 'forbidden',
      });
      return;
    }

    client.join(getBaseRoomName(pageId));
    this.subscriptionsFor(client).add(pageId);

    // Send the current presence snapshot to just this client so their UI
    // can paint who's already editing what.
    const snapshot = await this.presence.snapshot(pageId);
    client.emit('message', {
      operation: 'base:presence:snapshot',
      pageId,
      entries: snapshot,
    });
  }

  private async unsubscribe(client: Socket, pageId: string): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;

    client.leave(getBaseRoomName(pageId));
    this.subscriptionsFor(client).delete(pageId);

    await this.presence.leave(pageId, userId);
    this.emitToBase(pageId, {
      operation: 'base:presence:leave',
      pageId,
      userId,
    });
  }

  private async handlePresence(
    client: Socket,
    data: Extract<BaseInbound, { operation: 'base:presence' }>,
  ): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;
    if (!client.rooms.has(getBaseRoomName(data.pageId))) return;

    const entry: PresenceEntry = {
      userId,
      cellId: data.cellId ?? null,
      selection: data.selection ?? null,
      ts: Date.now(),
    };
    await this.presence.setPresence(data.pageId, entry);

    this.emitToBase(data.pageId, {
      operation: 'base:presence',
      pageId: data.pageId,
      ...entry,
    });
  }

  private async handlePresenceLeave(
    client: Socket,
    pageId: string,
  ): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;
    await this.presence.leave(pageId, userId);
    this.emitToBase(pageId, {
      operation: 'base:presence:leave',
      pageId,
      userId,
    });
  }

  // Bases are pages — gate the WS subscribe through the same
  // pageAccessService.validateCanView check the rest of the base
  // surface (HTTP endpoints, page collab) uses, so per-page
  // restrictions / sharing rules apply uniformly. This used to do a
  // bare "is the user a member of the space at all" check, which let
  // a user with a per-base restriction stream live updates for a
  // base they couldn't otherwise read.
  private async canReadBase(
    userId: string,
    workspaceId: string,
    base: { id: string; spaceId: string },
  ): Promise<boolean> {
    const user = await this.userRepo.findById(userId, workspaceId);
    if (!user) return false;
    try {
      // Pass the base as a Page — same shape (isBase=true), and
      // validateCanView only reads `id` + `spaceId` off it.
      await this.pageAccessService.validateCanView(base as any, user);
      return true;
    } catch {
      return false;
    }
  }

  private subscriptionsFor(client: Socket): Set<string> {
    const existing = client.data.baseSubscriptions as Set<string> | undefined;
    if (existing) return existing;
    const fresh = new Set<string>();
    client.data.baseSubscriptions = fresh;
    return fresh;
  }
}
