import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../core/auth/services/token.service';
import { JwtPayload, JwtType } from '../core/auth/dto/jwt-payload';
import { OnModuleDestroy } from '@nestjs/common';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import * as cookie from 'cookie';
import { ExcalidrawCollabService } from './services/excalidraw-collab.service';
import { ExcalidrawFollowPayload } from './types/excalidraw.types';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class WsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  constructor(
    private tokenService: TokenService,
    private spaceMemberRepo: SpaceMemberRepo,
    private excalidrawCollabService: ExcalidrawCollabService,
  ) {}

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    try {
      const cookies = cookie.parse(client.handshake.headers.cookie);
      const token: JwtPayload = await this.tokenService.verifyJwt(
        cookies['authToken'],
        JwtType.ACCESS,
      );

      const userId = token.sub;
      const workspaceId = token.workspaceId;

      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

      const workspaceRoom = `workspace-${workspaceId}`;
      const spaceRooms = userSpaceIds.map((id) => this.getSpaceRoomName(id));

      client.join([workspaceRoom, ...spaceRooms]);

      this.server.to(client.id).emit('init-room');
    } catch (err) {
      client.emit('Unauthorized');
      client.disconnect();
    }
  }

  @SubscribeMessage('message')
  handleMessage(client: Socket, data: any): void {
    const spaceEvents = [
      'updateOne',
      'addTreeNode',
      'moveTreeNode',
      'deleteTreeNode',
    ];

    if (spaceEvents.includes(data?.operation) && data?.spaceId) {
      const room = this.getSpaceRoomName(data.spaceId);
      client.broadcast.to(room).emit('message', data);
      return;
    }

    client.broadcast.emit('message', data);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ): Promise<void> {
    await this.excalidrawCollabService.handleJoinRoom(
      client,
      this.server,
      roomId,
    );
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomName: string,
  ): void {
    client.leave(roomName);
  }

  @SubscribeMessage('server-broadcast')
  handleServerBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() [roomId, encryptedData, iv]: [string, ArrayBuffer, Uint8Array],
  ): void {
    this.excalidrawCollabService.handleServerBroadcast(
      client,
      roomId,
      encryptedData,
      iv,
    );
  }

  @SubscribeMessage('server-volatile-broadcast')
  handleServerVolatileBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() [roomId, encryptedData, iv]: [string, ArrayBuffer, Uint8Array],
  ): void {
    this.excalidrawCollabService.handleServerVolatileBroadcast(
      client,
      roomId,
      encryptedData,
      iv,
    );
  }

  @SubscribeMessage('user-follow')
  async handleUserFollow(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ExcalidrawFollowPayload,
  ): Promise<void> {
    await this.excalidrawCollabService.handleUserFollow(
      client,
      this.server,
      payload,
    );
  }

  async handleDisconnect(client: Socket): Promise<void> {
    await this.excalidrawCollabService.handleDisconnecting(client, this.server);
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
    }
  }

  getSpaceRoomName(spaceId: string): string {
    return `space-${spaceId}`;
  }
}
