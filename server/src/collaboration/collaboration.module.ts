import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { UserModule } from '../core/user/user.module';
import { AuthModule } from '../core/auth/auth.module';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { PageModule } from '../core/page/page.module';
import { CollaborationGateway } from './collaboration.gateway';
import { HttpAdapterHost } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import WebSocket from 'ws';
import { IncomingMessage } from 'http';

@Module({
  providers: [
    CollaborationGateway,
    AuthenticationExtension,
    PersistenceExtension,
  ],
  imports: [UserModule, AuthModule, PageModule],
})
export class CollaborationModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly collaborationGateway: CollaborationGateway,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit() {
    const port = 0; // zero to reuse existing server port
    const path = '/collaboration';

    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
    const wsAdapter = new WsAdapter(httpServer).create(port, {
      path,
    });

    wsAdapter.on(
      'connection',
      (client: WebSocket, request: IncomingMessage) => {
        this.collaborationGateway.handleConnection(client, request);
      },
    );
  }

  onModuleDestroy(): any {
    this.collaborationGateway.handleDestroy();
  }
}
