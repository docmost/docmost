import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server as HocuspocusServer } from '@hocuspocus/server';
import { IncomingMessage } from 'http';
import WebSocket, { Server } from 'ws';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';

@WebSocketGateway({ path: '/collaboration' })
export class CollaborationGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private authenticationExtension: AuthenticationExtension,
    private persistenceExtension: PersistenceExtension,
  ) {}

  private hocuspocus = HocuspocusServer.configure({
    debounce: 5000,
    maxDebounce: 10000,
    extensions: [this.authenticationExtension, this.persistenceExtension],
  });

  handleConnection(client: WebSocket, request: IncomingMessage): any {
    this.hocuspocus.handleConnection(client, request);
  }
}
