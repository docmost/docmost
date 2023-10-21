import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { UserModule } from '../core/user/user.module';
import { AuthModule } from '../core/auth/auth.module';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { PageModule } from '../core/page/page.module';
import { CollaborationGateway } from './collaboration.gateway';
import { HttpAdapterHost } from '@nestjs/core';
import { CollabWsAdapter } from './adapter/collab-ws.adapter';
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';

@Module({
  providers: [
    CollaborationGateway,
    AuthenticationExtension,
    PersistenceExtension,
  ],
  imports: [UserModule, AuthModule, PageModule],
})
export class CollaborationModule implements OnModuleInit, OnModuleDestroy {
  private collabWsAdapter: CollabWsAdapter;
  private path = '/collaboration';

  constructor(
    private readonly collaborationGateway: CollaborationGateway,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit() {
    this.collabWsAdapter = new CollabWsAdapter();
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();

    const wss = this.collabWsAdapter.handleUpgrade(this.path, httpServer);

    wss.on('connection', (client: WebSocket, request: IncomingMessage) => {
      this.collaborationGateway.handleConnection(client, request);
    });
  }

  onModuleDestroy(): any {
    this.collaborationGateway.destroy();
    this.collabWsAdapter.destroy();
  }
}
