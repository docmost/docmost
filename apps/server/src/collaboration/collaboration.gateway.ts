import { Hocuspocus } from '@hocuspocus/server';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { Injectable, Logger } from '@nestjs/common';
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
import { toWebRequest } from './extensions/redis-sync/redis-sync.types';
import { WsSocketWrapper } from './extensions/redis-sync/ws-socket-wrapper';
import RedisClient from 'ioredis';
import { pack, unpack } from 'msgpackr';
import { nanoid } from 'nanoid';
import * as os from 'node:os';
import { CollabWsAdapter } from './adapter/collab-ws.adapter';
import {
  CollaborationHandler,
  CollabEventHandlers,
} from './collaboration.handler';

@Injectable()
export class CollaborationGateway {
  private readonly logger = new Logger(CollaborationGateway.name);
  private readonly hocuspocus: Hocuspocus;
  private redisConfig: RedisConfig;
  // @ts-ignore
  private readonly redisSync: RedisSyncExtension<CollabEventHandlers> | null =
    null;
  private readonly withRedis: boolean;
  private readonly eventHandlers: CollabEventHandlers;

  constructor(
    private authenticationExtension: AuthenticationExtension,
    private persistenceExtension: PersistenceExtension,
    private loggerExtension: LoggerExtension,
    private environmentService: EnvironmentService,
    private collabEventsService: CollaborationHandler,
  ) {
    this.redisConfig = parseRedisUrl(this.environmentService.getRedisUrl());
    this.withRedis = !this.environmentService.isCollabDisableRedis();

    this.hocuspocus = new Hocuspocus({
      debounce: 10000,
      maxDebounce: 45000,
      unloadImmediately: false,
      extensions: [
        this.authenticationExtension,
        this.persistenceExtension,
        this.loggerExtension,
      ],
    });

    this.eventHandlers = this.collabEventsService.getHandlers(this.hocuspocus);

    if (this.withRedis) {
      // @ts-ignore
      this.redisSync = new RedisSyncExtension({
        redis: new RedisClient({
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          password: this.redisConfig.password,
          db: this.redisConfig.db,
          family: this.redisConfig.family,
          retryStrategy: createRetryStrategy(),
        }),
        serverId: `collab-${os?.hostname()}-${nanoid(10)}`,
        prefix: 'collab',
        pack,
        unpack,
        // @ts-ignore
        customEvents: this.eventHandlers,
      });
      this.hocuspocus.configuration.extensions.push(this.redisSync);
      // @ts-ignore
      this.redisSync.onConfigure({ instance: this.hocuspocus });
    }
  }

  private serializeRequest(request: IncomingMessage): SerializedHTTPRequest {
    return {
      method: request.method ?? 'GET',
      url: request.url ?? '/',
      headers: {
        'sec-websocket-key': request.headers['sec-websocket-key'] ?? '',
        'sec-websocket-protocol':
          request.headers['sec-websocket-protocol'] ?? '',
      },
      socket: { remoteAddress: request.socket?.remoteAddress ?? '' },
    };
  }

  /**
   * A Yjs frame that we fail to apply is gone for good — the provider never
   * retransmits it, and the client keeps believing it is in sync. Close the
   * socket instead: the provider reconnects and replays SyncStep1/2 from its
   * local Y.Doc, which re-sends everything it knows. Silent permanent loss
   * becomes a visible ~1s reconnect.
   */
  private dropFrame(client: WebSocket, socketId: string, error: unknown) {
    this.logger.error(
      `Inbound collab frame not applied (socket ${socketId}); ` +
        `closing to force a resync`,
      error instanceof Error ? error.stack : String(error),
    );
    try {
      client.close(1011, 'collab sync unavailable');
    } catch {
      // socket already torn down
    }
  }

  handleConnection(client: WebSocket, request: IncomingMessage): any {
    if (this.redisSync) {
      const serializedHTTPRequest = this.serializeRequest(request);
      const socketId = serializedHTTPRequest.headers['sec-websocket-key'];

      const wrappedSocket = new WsSocketWrapper(client);

      // Route through RedisSync extension (this calls handleConnection internally)
      this.redisSync.onSocketOpen(wrappedSocket, serializedHTTPRequest);

      client.on('message', (data: ArrayBuffer) => {
        this.redisSync!.onSocketMessage(serializedHTTPRequest, data).catch(
          (error) => this.dropFrame(client, socketId, error),
        );
      });

      client.on('close', (code: number, reason: Buffer) => {
        this.redisSync!.onSocketClose(
          socketId,
          code,
          new Uint8Array(reason).buffer,
        );
      });
    } else {
      // Fallback to direct Hocuspocus connection
      const socketId =
        request.headers['sec-websocket-key'] ?? '<unknown>';
      const clientConnection = this.hocuspocus.handleConnection(
        client,
        toWebRequest(this.serializeRequest(request)),
      );

      client.on('message', (data: Buffer) => {
        try {
          clientConnection.handleMessage(new Uint8Array(data));
        } catch (error) {
          this.dropFrame(client, String(socketId), error);
        }
      });

      client.on('close', (code: number, reason: Buffer) => {
        clientConnection.handleClose({ code, reason: reason.toString() });
      });
    }
  }

  getConnectionCount() {
    return this.hocuspocus.getConnectionsCount();
  }

  getDocumentCount() {
    return this.hocuspocus.getDocumentsCount();
  }

  /**
   * With Redis, the event may need to run on whichever node owns the document,
   * so it is routed through the sync extension. Without Redis this node owns
   * every document — call the handler directly. Optional-chaining the redisSync
   * here used to make comment marks and REST content writes silent no-ops
   * whenever COLLAB_DISABLE_REDIS was on.
   */
  handleYjsEvent<TName extends keyof CollabEventHandlers>(
    eventName: TName,
    documentName: string,
    payload: Parameters<CollabEventHandlers[TName]>[1],
  ) {
    if (this.redisSync) {
      return this.redisSync.handleEvent(eventName, documentName, payload);
    }
    return (this.eventHandlers[eventName] as any)(documentName, payload);
  }

  openDirectConnection(documentName: string, context?: any) {
    return this.hocuspocus.openDirectConnection(documentName, context);
  }

  /*
   *Can be used before calling openDirectConnection directly.
   *Without Redis there is a single node, so there is nothing to lock against.
   */
  async lockDocument(documentName: string) {
    if (!this.redisSync) return () => Promise.resolve(0);
    return this.redisSync.lockDocument(documentName);
  }

  /*
   *Releases a document lock and stops the interval that maintains it.
   */
  async releaseLock(documentName: string) {
    if (!this.redisSync) return 0;
    return this.redisSync.releaseLock(documentName);
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
        this.hocuspocus.flushPendingStores();
      } catch (error) {
        console.error(error);
      }
    });

    await this.hocuspocus.hooks('onDestroy', { instance: this.hocuspocus });
  }
}
