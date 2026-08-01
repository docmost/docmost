import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { CollaborationGateway } from './collaboration.gateway';
import { HttpAdapterHost } from '@nestjs/core';
import { CollabWsAdapter } from './adapter/collab-ws.adapter';
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { TokenModule } from '../core/auth/token.module';
import { HistoryProcessor } from './processors/history.processor';
import { LoggerExtension } from './extensions/logger.extension';
import { CollaborationHandler } from './collaboration.handler';
import { CollabHistoryService } from './services/collab-history.service';
import { E2eeRelayService } from './e2ee/e2ee-relay.service';
import { E2eePageListener } from './e2ee/e2ee-page.listener';
import { WatcherModule } from '../core/watcher/watcher.module';
import { TransclusionService } from '../core/page/transclusion/transclusion.service';
import { TransclusionModule } from '../core/page/transclusion/transclusion.module';
import { StorageModule } from '../integrations/storage/storage.module';
import { EnvironmentModule } from '../integrations/environment/environment.module';

@Module({
  providers: [
    CollaborationGateway,
    AuthenticationExtension,
    PersistenceExtension,
    LoggerExtension,
    HistoryProcessor,
    CollabHistoryService,
    CollaborationHandler,
    TransclusionService,
    E2eeRelayService,
    E2eePageListener,
  ],
  exports: [CollaborationGateway, E2eeRelayService],
  imports: [
    TokenModule,
    WatcherModule,
    StorageModule.forRootAsync({
      imports: [EnvironmentModule],
    }),
    TransclusionModule,
  ],
})
export class CollaborationModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollaborationModule.name);
  private collabWsAdapter: CollabWsAdapter;
  private path = '/collab';

  constructor(
    private readonly collaborationGateway: CollaborationGateway,
    private readonly e2eeRelayService: E2eeRelayService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit() {
    this.collabWsAdapter = new CollabWsAdapter();
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();

    const wss = this.collabWsAdapter.handleUpgrade(this.path, httpServer);

    wss.on('connection', (client: WebSocket, request: IncomingMessage) => {
      // encrypted pages use a blind ciphertext relay on the same ws path,
      // selected by query flag (the upgrade handler only accepts this.path)
      if (this.isE2eeRequest(request)) {
        this.e2eeRelayService.handleConnection(client, request);
      } else {
        this.collaborationGateway.handleConnection(client, request);
      }

      client.on('error', (error) => {
        this.logger.error('WebSocket client error:', error);
      });
    });

    wss.on('error', (error) =>
      this.logger.error('WebSocket server error:', error),
    );
  }

  private isE2eeRequest(request: IncomingMessage): boolean {
    try {
      const url = new URL(request.url ?? '/', 'ws://localhost');
      return url.searchParams.get('e2ee') === '1';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.collaborationGateway?.destroy(this.collabWsAdapter);
    this.collabWsAdapter?.destroy();
  }
}
