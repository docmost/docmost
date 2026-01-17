import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ExcalidrawFollowPayload } from '../types/excalidraw.types';

@Injectable()
export class ExcalidrawCollabService {
  // Track socket -> rooms mapping for disconnect handling
  // (Socket.IO clears client.rooms before handleDisconnect runs)
  private socketRooms = new Map<string, Set<string>>();

  async handleJoinRoom(
    client: Socket,
    server: Server,
    roomId: string,
  ): Promise<void> {
    await client.join(roomId);

    // Track room membership
    if (!this.socketRooms.has(client.id)) {
      this.socketRooms.set(client.id, new Set());
    }
    this.socketRooms.get(client.id).add(roomId);

    const sockets = await server.in(roomId).fetchSockets();

    if (sockets.length <= 1) {
      server.to(client.id).emit('ex-first-in-room');
    } else {
      client.broadcast.to(roomId).emit('ex-new-user', client.id);
    }

    server.in(roomId).emit(
      'ex-room-user-change',
      sockets.map((socket) => socket.id),
    );
  }

  async handleLeaveRoom(
    client: Socket,
    server: Server,
    roomId: string,
  ): Promise<void> {
    await client.leave(roomId);

    // Remove from tracking
    this.socketRooms.get(client.id)?.delete(roomId);

    // Notify remaining users
    const sockets = await server.in(roomId).fetchSockets();
    if (sockets.length > 0) {
      server.in(roomId).emit(
        'ex-room-user-change',
        sockets.map((socket) => socket.id),
      );
    }
  }

  handleServerBroadcast(
    client: Socket,
    roomId: string,
    encryptedData: ArrayBuffer,
    iv: Uint8Array,
  ): void {
    client.broadcast.to(roomId).emit('ex-client-broadcast', encryptedData, iv);
  }

  handleServerVolatileBroadcast(
    client: Socket,
    roomId: string,
    encryptedData: ArrayBuffer,
    iv: Uint8Array,
  ): void {
    client.volatile.broadcast
      .to(roomId)
      .emit('ex-client-broadcast', encryptedData, iv);
  }

  async handleUserFollow(
    client: Socket,
    server: Server,
    payload: ExcalidrawFollowPayload,
  ): Promise<void> {
    const roomId = `follow@${payload.userToFollow.socketId}`;

    if (payload.action === 'FOLLOW') {
      await client.join(roomId);
    } else {
      await client.leave(roomId);
    }

    const sockets = await server.in(roomId).fetchSockets();
    const followedBy = sockets.map((socket) => socket.id);

    server.to(payload.userToFollow.socketId).emit(
      'ex-user-follow-room-change',
      followedBy,
    );
  }

  async handleDisconnecting(client: Socket, server: Server): Promise<void> {
    // Use tracked rooms since client.rooms is empty by this point
    const rooms = this.socketRooms.get(client.id) || new Set();

    for (const roomId of rooms) {
      const otherClients = (await server.in(roomId).fetchSockets()).filter(
        (socket) => socket.id !== client.id,
      );

      const isFollowRoom = roomId.startsWith('follow@');

      if (!isFollowRoom && otherClients.length > 0) {
        server.to(roomId).emit(
          'ex-room-user-change',
          otherClients.map((socket) => socket.id),
        );
      }

      if (isFollowRoom && otherClients.length === 0) {
        const socketId = roomId.replace('follow@', '');
        server.to(socketId).emit('ex-broadcast-unfollow');
      }
    }

    // Clean up tracking
    this.socketRooms.delete(client.id);
  }
}
