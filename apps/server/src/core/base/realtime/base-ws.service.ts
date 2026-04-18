import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { Server, Socket } from 'socket.io';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { getBaseRoomName } from '../../../ws/ws.utils';
import { BasePresenceService, PresenceEntry } from './base-presence.service';

/*
 * Inbound shapes from untrusted socket clients. Zod-validated at the
 * boundary so malformed payloads (non-uuid baseId, missing fields,
 * oversized selection blobs) never reach the permission check or Redis.
 */
const baseSubscribeSchema = z.object({
  operation: z.literal('base:subscribe'),
  baseId: z.uuid(),
});

const baseUnsubscribeSchema = z.object({
  operation: z.literal('base:unsubscribe'),
  baseId: z.uuid(),
});

const basePresenceSchema = z.object({
  operation: z.literal('base:presence'),
  baseId: z.uuid(),
  cellId: z.string().max(200).optional().nullable(),
  selection: z.unknown().optional(),
});

const basePresenceLeaveSchema = z.object({
  operation: z.literal('base:presence:leave'),
  baseId: z.uuid(),
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
    private readonly spaceMemberRepo: SpaceMemberRepo,
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
        await this.subscribe(client, data.baseId);
        return;
      case 'base:unsubscribe':
        await this.unsubscribe(client, data.baseId);
        return;
      case 'base:presence':
        await this.handlePresence(client, data);
        return;
      case 'base:presence:leave':
        await this.handlePresenceLeave(client, data.baseId);
        return;
    }
  }

  emitToBase(baseId: string, payload: BaseOutbound): void {
    if (!this.server) return;
    this.server.to(getBaseRoomName(baseId)).emit('message', payload);
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
    for (const baseId of subs) {
      await this.presence.leave(baseId, userId);
      this.emitToBase(baseId, {
        operation: 'base:presence:leave',
        baseId,
        userId,
      });
    }
    subs.clear();
  }

  // --- private -------------------------------------------------------

  private async subscribe(client: Socket, baseId: string): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) {
      client.emit('message', {
        operation: 'base:subscribe:error',
        baseId,
        reason: 'unauthenticated',
      });
      return;
    }

    const base = await this.baseRepo.findById(baseId);
    if (!base) {
      client.emit('message', {
        operation: 'base:subscribe:error',
        baseId,
        reason: 'not_found',
      });
      return;
    }

    const canRead = await this.canReadBaseSpace(userId, base.spaceId);
    if (!canRead) {
      client.emit('message', {
        operation: 'base:subscribe:error',
        baseId,
        reason: 'forbidden',
      });
      return;
    }

    client.join(getBaseRoomName(baseId));
    this.subscriptionsFor(client).add(baseId);

    // Send the current presence snapshot to just this client so their UI
    // can paint who's already editing what.
    const snapshot = await this.presence.snapshot(baseId);
    client.emit('message', {
      operation: 'base:presence:snapshot',
      baseId,
      entries: snapshot,
    });
  }

  private async unsubscribe(client: Socket, baseId: string): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;

    client.leave(getBaseRoomName(baseId));
    this.subscriptionsFor(client).delete(baseId);

    await this.presence.leave(baseId, userId);
    this.emitToBase(baseId, {
      operation: 'base:presence:leave',
      baseId,
      userId,
    });
  }

  private async handlePresence(
    client: Socket,
    data: Extract<BaseInbound, { operation: 'base:presence' }>,
  ): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;
    if (!client.rooms.has(getBaseRoomName(data.baseId))) return;

    const entry: PresenceEntry = {
      userId,
      cellId: data.cellId ?? null,
      selection: data.selection ?? null,
      ts: Date.now(),
    };
    await this.presence.setPresence(data.baseId, entry);

    this.emitToBase(data.baseId, {
      operation: 'base:presence',
      baseId: data.baseId,
      ...entry,
    });
  }

  private async handlePresenceLeave(
    client: Socket,
    baseId: string,
  ): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;
    await this.presence.leave(baseId, userId);
    this.emitToBase(baseId, {
      operation: 'base:presence:leave',
      baseId,
      userId,
    });
  }

  private async canReadBaseSpace(
    userId: string,
    spaceId: string,
  ): Promise<boolean> {
    const roles = await this.spaceMemberRepo.getUserSpaceRoles(userId, spaceId);
    return !!findHighestUserSpaceRole(roles);
  }

  private subscriptionsFor(client: Socket): Set<string> {
    const existing = client.data.baseSubscriptions as Set<string> | undefined;
    if (existing) return existing;
    const fresh = new Set<string>();
    client.data.baseSubscriptions = fresh;
    return fresh;
  }
}
