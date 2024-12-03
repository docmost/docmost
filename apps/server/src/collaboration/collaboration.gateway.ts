import { Hocuspocus, Server as HocuspocusServer } from '@hocuspocus/server';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { Injectable } from '@nestjs/common';
import { Redis } from '@hocuspocus/extension-redis';
import { EnvironmentService } from '../integrations/environment/environment.service';
import {
  createRetryStrategy,
  parseRedisUrl,
  RedisConfig,
} from '../common/helpers';

@Injectable()
export class CollaborationGateway {
  private hocuspocus: Hocuspocus;
  private redisConfig: RedisConfig;

  constructor(
    private authenticationExtension: AuthenticationExtension,
    private persistenceExtension: PersistenceExtension,
    private environmentService: EnvironmentService,
  ) {
    this.redisConfig = parseRedisUrl(this.environmentService.getRedisUrl());

    this.hocuspocus = HocuspocusServer.configure({
      debounce: 5000,
      maxDebounce: 10000,
      unloadImmediately: false,
      extensions: [
        this.authenticationExtension,
        this.persistenceExtension,
        new Redis({
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          options: {
            password: this.redisConfig.password,
            db: this.redisConfig.db,
            retryStrategy: createRetryStrategy(),
          },
        }),
      ],
    });
  }

  handleConnection(client: WebSocket, request: IncomingMessage): any {
    this.hocuspocus.handleConnection(client, request);
  }

  async destroy(): Promise<void> {
    await this.hocuspocus.destroy();
  }
}
