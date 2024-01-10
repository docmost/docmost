import { Server as HocuspocusServer } from '@hocuspocus/server';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { Injectable } from '@nestjs/common';
import { HistoryExtension } from './extensions/history.extension';

@Injectable()
export class CollaborationGateway {
  constructor(
    private authenticationExtension: AuthenticationExtension,
    private persistenceExtension: PersistenceExtension,
    private historyExtension: HistoryExtension,
  ) {}

  private hocuspocus = HocuspocusServer.configure({
    debounce: 5000,
    maxDebounce: 10000,
    extensions: [
      this.authenticationExtension,
      this.persistenceExtension,
      this.historyExtension,
    ],
  });

  handleConnection(client: WebSocket, request: IncomingMessage): any {
    this.hocuspocus.handleConnection(client, request);
  }

  destroy() {
    this.hocuspocus.destroy();
  }
}
