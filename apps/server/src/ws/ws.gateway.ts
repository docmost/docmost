import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../core/auth/services/token.service';
import { JwtType } from '../core/auth/dto/jwt-payload';
import { OnModuleDestroy } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class WsGateway implements OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer()
  server: Server;
  constructor(private tokenService: TokenService) {}

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    try {
      const token = await this.tokenService.verifyJwt(
        client.handshake.auth?.token,
      );
      if (token.type !== JwtType.ACCESS) {
        client.disconnect();
      }
    } catch (err) {
      client.disconnect();
    }
  }

  @SubscribeMessage('message')
  handleMessage(client: Socket, data: string): void {
    client.broadcast.emit('message', data);
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
    }
  }
}
