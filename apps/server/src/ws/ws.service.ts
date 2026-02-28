import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Server, Socket } from 'socket.io';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import {
  TREE_EVENTS,
  WS_SPACE_RESTRICTION_CACHE_PREFIX,
  WS_CACHE_TTL_MS,
  getSpaceRoomName,
  getUserRoomName,
} from './ws.utils';

@Injectable()
export class WsService {
  private server: Server;

  constructor(
    private readonly pagePermissionRepo: PagePermissionRepo,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  setServer(server: Server): void {
    this.server = server;
  }

  async handleTreeEvent(client: Socket, data: any): Promise<void> {
    const room = getSpaceRoomName(data.spaceId);

    const hasRestrictions = await this.spaceHasRestrictions(data.spaceId);
    if (!hasRestrictions) {
      client.broadcast.to(room).emit('message', data);
      return;
    }

    const pageId = this.extractPageId(data);
    if (!pageId) {
      return;
    }

    const isRestricted =
      await this.pagePermissionRepo.hasRestrictedAncestor(pageId);
    if (!isRestricted) {
      client.broadcast.to(room).emit('message', data);
      return;
    }

    await this.broadcastToAuthorizedUsers(client, room, pageId, data);
  }

  async invalidateSpaceRestrictionCache(spaceId: string): Promise<void> {
    await this.cacheManager.del(
      `${WS_SPACE_RESTRICTION_CACHE_PREFIX}${spaceId}`,
    );
  }

  async emitToUsers(userIds: string[], data: any): Promise<void> {
    if (userIds.length === 0) return;
    const rooms = userIds.map((id) => getUserRoomName(id));
    this.server.to(rooms).emit('message', data);
  }

  async emitToSpaceExceptUsers(
    spaceId: string,
    excludeUserIds: string[],
    data: any,
  ): Promise<void> {
    const room = getSpaceRoomName(spaceId);
    const sockets = await this.server.in(room).fetchSockets();
    const excludeSet = new Set(excludeUserIds);

    for (const socket of sockets) {
      const userId = socket.data.userId as string;
      if (userId && !excludeSet.has(userId)) {
        socket.emit('message', data);
      }
    }
  }

  isTreeEvent(data: any): boolean {
    return TREE_EVENTS.has(data?.operation) && !!data?.spaceId;
  }

  private async broadcastToAuthorizedUsers(
    sender: Socket,
    room: string,
    pageId: string,
    data: any,
  ): Promise<void> {
    const sockets = await this.server.in(room).fetchSockets();

    const otherSockets = sockets.filter((s) => s.id !== sender.id);
    if (otherSockets.length === 0) return;

    const userSocketMap = new Map<string, typeof otherSockets>();
    for (const socket of otherSockets) {
      const userId = socket.data.userId as string;
      if (!userId) continue;
      const existing = userSocketMap.get(userId);
      if (existing) {
        existing.push(socket);
      } else {
        userSocketMap.set(userId, [socket]);
      }
    }

    const candidateUserIds = Array.from(userSocketMap.keys());
    if (candidateUserIds.length === 0) return;

    const authorizedUserIds =
      await this.pagePermissionRepo.getUserIdsWithPageAccess(
        pageId,
        candidateUserIds,
      );

    const authorizedSet = new Set(authorizedUserIds);
    for (const [userId, userSockets] of userSocketMap) {
      if (authorizedSet.has(userId)) {
        for (const socket of userSockets) {
          socket.emit('message', data);
        }
      }
    }
  }

  private async spaceHasRestrictions(spaceId: string): Promise<boolean> {
    const cacheKey = `${WS_SPACE_RESTRICTION_CACHE_PREFIX}${spaceId}`;

    const cached = await this.cacheManager.get<boolean>(cacheKey);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const hasRestrictions =
      await this.pagePermissionRepo.hasRestrictedPagesInSpace(spaceId);

    await this.cacheManager.set(cacheKey, hasRestrictions, WS_CACHE_TTL_MS);

    return hasRestrictions;
  }

  private extractPageId(data: any): string | null {
    switch (data.operation) {
      case 'addTreeNode':
        return data.payload?.data?.id ?? null;
      case 'moveTreeNode':
        return data.payload?.id ?? null;
      case 'deleteTreeNode':
        return data.payload?.node?.id ?? null;
      case 'updateOne':
        return data.id ?? null;
      default:
        return null;
    }
  }
}
