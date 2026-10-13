import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../core/auth/services/token.service';
import { JwtPayload, JwtType } from '../core/auth/dto/jwt-payload';
import { OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError } from '@nestjs/jwt';
import { WsService } from './ws.service';
import {
  getSessionRoomName,
  getSpaceRoomName,
  getUserRoomName,
} from './ws.utils';
import { BaseRealtimeBridge } from './base-realtime.bridge';
import * as cookie from 'cookie';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class WsGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  constructor(
    private tokenService: TokenService,
    private wsService: WsService,
    private baseRealtime: BaseRealtimeBridge,
  ) {}

  afterInit(server: Server): void {
    this.wsService.setServer(server);
    this.baseRealtime.setServer(server);
  }

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    try {
      const cookies = cookie.parse(client.handshake.headers.cookie ?? '');
      const token: JwtPayload = await this.tokenService.verifyJwt(
        cookies['authToken'],
        JwtType.ACCESS,
      );

      const userId = token.sub;
      const workspaceId = token.workspaceId;

      const userSpaceIds = await this.wsService.authorizeConnection(token);

      client.data.userId = userId;
      client.data.workspaceId = workspaceId;

      const userRoom = getUserRoomName(userId);
      const workspaceRoom = `workspace-${workspaceId}`;
      const spaceRooms = userSpaceIds.map((id) => getSpaceRoomName(id));
      const sessionRooms = token.sessionId
        ? [getSessionRoomName(token.sessionId)]
        : [];

      client.join([userRoom, workspaceRoom, ...spaceRooms, ...sessionRooms]);
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof JsonWebTokenError
      ) {
        client.emit('Unauthorized');
        client.disconnect();
        return;
      }
      // not an auth failure, closing the transport lets the client reconnect
      client.conn.close();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    await this.baseRealtime.handleDisconnect(client);
  }

  @SubscribeMessage('message')
  async handleMessage(client: Socket, data: any): Promise<void> {
    if (this.wsService.isTreeEvent(data)) {
      await this.wsService.handleTreeEvent(client, data);
      return;
    }
    if (this.baseRealtime.isBaseEvent(data)) {
      await this.baseRealtime.handleInbound(client, data);
      return;
    }
  }

  /*
  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, @MessageBody() roomName: string): void {
    // if room is a space, check if user has permissions
    //client.join(roomName);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, @MessageBody() roomName: string): void {
    client.leave(roomName);
  }
 */

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
    }
  }
}
