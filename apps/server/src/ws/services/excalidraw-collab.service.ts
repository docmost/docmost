import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ExcalidrawFollowPayload } from '../types/excalidraw.types';

@Injectable()
export class ExcalidrawCollabService {
  async handleJoinRoom(
    client: Socket,
    server: Server,
    roomId: string,
  ): Promise<void> {
    await client.join(roomId);

    const sockets = await server.in(roomId).fetchSockets();

    if (sockets.length <= 1) {
      server.to(client.id).emit('first-in-room');
    } else {
      client.broadcast.to(roomId).emit('new-user', client.id);
    }

    server.in(roomId).emit(
      'room-user-change',
      sockets.map((socket) => socket.id),
    );
  }

  handleServerBroadcast(
    client: Socket,
    roomId: string,
    encryptedData: ArrayBuffer,
    iv: Uint8Array,
  ): void {
    client.broadcast.to(roomId).emit('client-broadcast', encryptedData, iv);
  }

  handleServerVolatileBroadcast(
    client: Socket,
    roomId: string,
    encryptedData: ArrayBuffer,
    iv: Uint8Array,
  ): void {
    client.volatile.broadcast
      .to(roomId)
      .emit('client-broadcast', encryptedData, iv);
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
      'user-follow-room-change',
      followedBy,
    );
  }

  async handleDisconnecting(client: Socket, server: Server): Promise<void> {
    for (const roomId of Array.from(client.rooms)) {
      const otherClients = (await server.in(roomId).fetchSockets()).filter(
        (socket) => socket.id !== client.id,
      );

      const isFollowRoom = roomId.startsWith('follow@');

      if (!isFollowRoom && otherClients.length > 0) {
        client.broadcast.to(roomId).emit(
          'room-user-change',
          otherClients.map((socket) => socket.id),
        );
      }

      if (isFollowRoom && otherClients.length === 0) {
        const socketId = roomId.replace('follow@', '');
        server.to(socketId).emit('broadcast-unfollow');
      }
    }
  }
}
