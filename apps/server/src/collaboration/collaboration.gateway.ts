import { Hocuspocus } from '@hocuspocus/server';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { Injectable } from '@nestjs/common';
import { EnvironmentService } from '../integrations/environment/environment.service';
import {
  createRetryStrategy,
  parseRedisUrl,
  RedisConfig,
} from '../common/helpers';
import { LoggerExtension } from './extensions/logger.extension';
import {
  RedisSyncExtension,
  SerializedHTTPRequest,
} from './extensions/redis-sync';
import { WsSocketWrapper } from './extensions/redis-sync/ws-socket-wrapper';
import RedisClient from 'ioredis';
import { pack, unpack } from 'msgpackr';
import { CollabWsAdapter } from './adapter/collab-ws.adapter';

@Injectable()
export class CollaborationGateway {
  private readonly hocuspocus: Hocuspocus;
  private redisConfig: RedisConfig;
  private readonly redisSync: RedisSyncExtension<{}> | null = null;
  private readonly useRedisSync: boolean;

  constructor(
    private authenticationExtension: AuthenticationExtension,
    private persistenceExtension: PersistenceExtension,
    private loggerExtension: LoggerExtension,
    private environmentService: EnvironmentService,
  ) {
    this.redisConfig = parseRedisUrl(this.environmentService.getRedisUrl());
    this.useRedisSync = !this.environmentService.isCollabDisableRedis();

    if (this.useRedisSync) {
      this.redisSync = new RedisSyncExtension({
        redis: new RedisClient({
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          password: this.redisConfig.password,
          db: this.redisConfig.db,
          family: this.redisConfig.family,
          retryStrategy: createRetryStrategy(),
        }),
        serverId: `collab-${process.pid}`,
        prefix: `collab`,
        pack,
        unpack,
        customEvents: {},
      });
    }

    this.hocuspocus = new Hocuspocus({
      debounce: 10000,
      maxDebounce: 45000,
      unloadImmediately: false,
      extensions: [
        this.authenticationExtension,
        this.persistenceExtension,
        this.loggerExtension,
        ...(this.redisSync ? [this.redisSync] : []),
      ],
    });
  }

  private serializeRequest(request: IncomingMessage): SerializedHTTPRequest {
    return {
      method: request.method ?? 'GET',
      url: request.url ?? '/',
      headers: {
        ...request.headers,
        'sec-websocket-key': request.headers['sec-websocket-key'] ?? '',
      } as SerializedHTTPRequest['headers'],
      socket: { remoteAddress: request.socket?.remoteAddress ?? '' },
    };
  }

  handleConnection(client: WebSocket, request: IncomingMessage): any {
    if (this.redisSync) {
      const serializedRequest = this.serializeRequest(request);
      const socketId = serializedRequest.headers['sec-websocket-key'];

      // Create wrapper socket that only receives events via emit()
      // This prevents double-handling since Hocuspocus won't listen to raw WebSocket events
      const wrappedSocket = new WsSocketWrapper(client);

      // Route through RedisSync extension (this calls handleConnection internally)
      this.redisSync.onSocketOpen(wrappedSocket as any, serializedRequest);

      // Forward raw WebSocket messages to the extension
      client.on('message', (data: ArrayBuffer) => {
        this.redisSync!.onSocketMessage(
          wrappedSocket as any,
          serializedRequest,
          data,
        );
      });

      // Forward close events
      client.on('close', (code: number, reason: Buffer) => {
        this.redisSync!.onSocketClose(socketId, code, reason);
      });

      // Forward pong events for keepalive
      client.on('pong', (data: Buffer) => {
        wrappedSocket.emit('pong', data);
      });
    } else {
      // Fallback to direct Hocuspocus connection
      this.hocuspocus.handleConnection(client, request);
    }
  }

  getConnectionCount() {
    return this.hocuspocus.getConnectionsCount();
  }

  getDocumentCount() {
    return this.hocuspocus.getDocumentsCount();
  }

  async destroy(collabWsAdapter: CollabWsAdapter): Promise<void> {
    // eslint-disable-next-line no-async-promise-executor
    await new Promise(async (resolve) => {
      try {
        // Wait for all documents to unload
        this.hocuspocus.configuration.extensions.push({
          async afterUnloadDocument({ instance }) {
            if (instance.getDocumentsCount() === 0) resolve('');
          },
        });

        collabWsAdapter?.close();

        if (this.hocuspocus.getDocumentsCount() === 0) resolve('');
        this.hocuspocus.closeConnections();
      } catch (error) {
        console.error(error);
      }
    });

    await this.hocuspocus.hooks('onDestroy', { instance: this.hocuspocus });
  }
}
