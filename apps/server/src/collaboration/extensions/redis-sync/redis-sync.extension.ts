// Adapted from https://github.com/ueberdosis/hocuspocus/pull/1008 - MIT
import { IncomingMessage } from 'node:http';
import {
  Extension,
  Hocuspocus,
  IncomingMessage as SocketIncomingMessage,
  afterUnloadDocumentPayload,
  onConfigurePayload,
  onLoadDocumentPayload,
} from '@hocuspocus/server';
import RedisClient from 'ioredis';
import { readVarString } from 'lib0/decoding.js';
import { WebSocket } from 'ws';
import { CollabProxySocket } from './collab-proxy-socket';
import { Injectable, Logger } from '@nestjs/common';
import {
  BaseWebSocket,
  Configuration,
  CustomEvents,
  Pack,
  RSAMessage,
  RSAMessageCloseProxy,
  RSAMessageCustomEventComplete,
  RSAMessageCustomEventStart,
  RSAMessagePong,
  RSAMessageProxy,
  RSAMessageUnload,
  SerializedHTTPRequest,
  Unpack,
} from './redis-sync.types';

export type { Pack, SerializedHTTPRequest } from './redis-sync.types';

type ServerId = string;
type DocumentName = string;
type SocketId = string;

export class RedisSyncExtension<TCE extends CustomEvents> implements Extension {
  private readonly logger = new Logger('Collab' + RedisSyncExtension.name);
  priority = 1000;
  private readonly pub: RedisClient;
  private sub: RedisClient;
  private readonly pack: Pack;
  private readonly unpack: Unpack;
  private originSockets: Record<SocketId, BaseWebSocket> = {};
  private locks: Record<DocumentName, NodeJS.Timeout> = {};
  private lockPromises: Record<DocumentName, Promise<ServerId | null>> = {};
  private proxySockets: Record<
    SocketId,
    { socket: CollabProxySocket; cleanup: NodeJS.Timeout }
  > = {};
  private readonly prefix: string;
  private readonly lockPrefix: string;
  private readonly msgChannel: string;
  private readonly serverId: ServerId;
  private readonly customEventTTL: number;
  private readonly lockTTL: number;
  private readonly proxySocketTTL: number;
  private instance!: Hocuspocus;
  private readonly customEvents: TCE;
  private replyIdCounter = 0;
  private pendingReplies: Record<
    number,
    // @ts-ignore
    PromiseWithResolvers<unknown>['resolve']
  > = {};
  constructor(configuration: Configuration<TCE>) {
    const {
      redis,
      pack,
      unpack,
      serverId,
      lockTTL,
      prefix,
      proxySocketTTL,
      customEvents,
      customEventTTL,
    } = configuration;
    this.pub = redis.duplicate();
    this.sub = redis.duplicate();
    this.pack = pack;
    this.unpack = unpack;
    this.serverId = serverId;
    this.lockTTL = lockTTL ?? 10_000;
    this.proxySocketTTL = proxySocketTTL ?? 30_000;
    this.customEventTTL = customEventTTL ?? 30_000;
    this.prefix = prefix ?? 'collab';
    this.lockPrefix = `${this.prefix}Lock`;
    this.msgChannel = `${this.prefix}Msg`;
    this.customEvents = (customEvents ?? {}) as unknown as TCE;
    this.sub.subscribe(this.msgChannel, `${this.msgChannel}:${this.serverId}`);
    this.sub.on('messageBuffer', this.handleRedisMessage);
  }
  private getKey(documentName: string) {
    return `${this.lockPrefix}:${documentName}`;
  }

  private closeProxy(socketId: string) {
    const socketRecord = this.proxySockets[socketId];
    if (!socketRecord) return;
    clearTimeout(socketRecord.cleanup);
    socketRecord.socket.emit('close', 1000, 'proxy_cleanup');
    delete this.proxySockets[socketId];
  }

  private emitPong(socketId: string) {
    const socketRecord = this.proxySockets[socketId];
    if (socketRecord) {
      socketRecord.socket.emit('pong');
    }
  }

  private handleProxyMessage(
    msg: Pick<RSAMessageProxy, 'replyTo' | 'message' | 'serializedHTTPRequest'>,
  ) {
    const { replyTo, message, serializedHTTPRequest } = msg;
    const { headers } = serializedHTTPRequest;
    const socketId = headers['sec-websocket-key'];
    let socketRecord = this.proxySockets[socketId];
    const cleanup = setTimeout(() => {
      const record = this.proxySockets[socketId];
      if (record) {
        record.socket.emit('close', 1000, 'ttl_expired');
        delete this.proxySockets[socketId];
      }
    }, this.proxySocketTTL);
    if (!socketRecord) {
      const socket = new CollabProxySocket(
        this.pub,
        this.pack,
        replyTo,
        `${this.msgChannel}:${this.serverId}`,
        socketId,
      );
      socketRecord = { socket, cleanup };
      this.proxySockets[socketId] = socketRecord;
      this.instance.handleConnection(
        socket as unknown as WebSocket,
        serializedHTTPRequest as unknown as IncomingMessage,
        {},
      );
    } else {
      clearTimeout(socketRecord.cleanup);
      socketRecord.cleanup = cleanup;
    }
    socketRecord.socket.emit('message', message);
  }

  private getOrClaimLock(documentName: string) {
    const lockPromise = this.pub.set(
      this.getKey(documentName),
      this.serverId,
      'PX',
      this.lockTTL,
      'NX',
      'GET',
    );
    this.lockPromises[documentName] = lockPromise;
    // Briefly cache the serverId that claimed the doc to reduce load on redis
    // When the claimant unloads the doc, it will send an unload message to immediately clear this
    // a lockTTL / 2 guarantees stale reads < lockTTL upon server crash
    setTimeout(() => {
      delete this.lockPromises[documentName];
    }, this.lockTTL / 2);
    return lockPromise;
  }

  private getOrClaimLockThrottled(documentName: string) {
    const existingWorkerIdPromise = this.lockPromises[documentName];
    if (existingWorkerIdPromise) return existingWorkerIdPromise;
    return this.getOrClaimLock(documentName);
  }

  private handleRedisMessage = async (
    _channel: Buffer,
    packedMessage: Buffer,
  ) => {
    const msg = this.unpack(packedMessage) as RSAMessage;
    const { type } = msg;
    if (type === 'proxy') {
      this.handleProxyMessage(msg);
      return;
    }
    if (type === 'closeProxy') {
      this.closeProxy(msg.socketId);
      return;
    }
    if (type === 'unload') {
      delete this.lockPromises[msg.documentName];
      return;
    }
    if (type === 'customEventStart') {
      const { documentName, eventName, payload, replyTo, replyId } = msg;
      const res = await this.handleEventLocally(
        eventName as Extract<keyof TCE, string>,
        documentName,
        payload,
      );
      const reply: RSAMessageCustomEventComplete = {
        type: 'customEventComplete',
        replyId,
        payload: res,
      };
      this.pub.publish(`${replyTo}`, this.pack(reply)).catch(() => {});
      return;
    }
    if (type === 'customEventComplete') {
      const { replyId, payload } = msg;
      const resolveFn = this.pendingReplies[replyId];
      if (!resolveFn) return;
      delete this.pendingReplies[replyId];
      resolveFn(payload);
      return;
    }
    if (type === 'pong') {
      this.emitPong(msg.socketId);
      return;
    }
    const { socketId } = msg;
    const socket = this.originSockets[socketId];
    if (!socket) {
      // origin socket already cleaned up
      return;
    }
    if (type === 'close') {
      socket.close(msg.code, msg.reason);
    } else if (type === 'ping') {
      const { respondTo } = msg;
      const pong: RSAMessagePong = { type: 'pong', socketId };
      this.pub.publish(respondTo, this.pack(pong)).catch(() => {});
    } else if (type === 'send') {
      socket.send(msg.message);
    }
  };

  async maintainLock(documentName: string) {
    this.locks[documentName] = setInterval(() => {
      this.pub.set(
        this.getKey(documentName),
        this.serverId,
        'PX',
        this.lockTTL,
      );
    }, this.lockTTL / 2);
  }

  async releaseLock(documentName: string) {
    clearInterval(this.locks[documentName]);
    delete this.locks[documentName];
    return this.pub.del(this.getKey(documentName));
  }

  private async handleEventLocally<TName extends Extract<keyof TCE, string>>(
    eventName: TName,
    documentName: string,
    payload: unknown,
  ) {
    const handler = this.customEvents[eventName];
    if (!handler) throw new Error(`Invalid eventName: ${eventName}`);
    const result = await handler(documentName, payload);
    return result as Promise<ReturnType<TCE[TName]>>;
  }

  async handleEvent<TName extends Extract<keyof TCE, string>>(
    eventName: TName,
    documentName: string,
    payload: unknown,
  ) {
    const isDocLoadedOnInstance = this.instance.documents.has(documentName);

    if (isDocLoadedOnInstance) {
      return this.handleEventLocally(eventName, documentName, payload);
    }

    const proxyTo = await this.getOrClaimLockThrottled(documentName);
    if (proxyTo && proxyTo !== this.serverId) {
      ++this.replyIdCounter; // bug in biome thinks this.replyIdCounter is not used if written on the line below
      const replyId = this.replyIdCounter;
      // another server owns the doc
      const proxyMessage: RSAMessageCustomEventStart = {
        eventName,
        documentName,
        payload,
        replyTo: `${this.msgChannel}:${this.serverId}`,
        replyId,
        type: 'customEventStart',
      };
      const msg = this.pack(proxyMessage);
      this.pub.publish(`${this.msgChannel}:${proxyTo}`, msg).catch(() => {});
      // @ts-ignore
      const { promise, resolve, reject } = Promise.withResolvers();
      const timeoutId = setTimeout(() => {
        delete this.pendingReplies[replyId];
        reject('TIMEOUT');
      }, this.customEventTTL);
      this.pendingReplies[replyId] = (result: unknown) => {
        clearTimeout(timeoutId);
        resolve(result);
      };
      return promise as Promise<ReturnType<TCE[TName]>>;
    }
    // This server owns the document, but hocuspocus hasn't loaded it yet
    return this.handleEventLocally(eventName, documentName, payload);
  }

  async lockDocument(documentName: string) {
    const proxyTo = await this.getOrClaimLockThrottled(documentName);
    if (proxyTo && proxyTo !== this.serverId) {
      throw new Error(`Could not lock document: ${documentName}`);
    }
    this.maintainLock(documentName);
    return () => this.releaseLock(documentName);
  }

  /* WebSocket Server Hooks */
  onSocketOpen(
    ws: BaseWebSocket,
    serializedHTTPRequest: SerializedHTTPRequest,
    context = {},
  ) {
    const socketId = serializedHTTPRequest.headers['sec-websocket-key'];
    this.originSockets[socketId] = ws;
    this.instance.handleConnection(
      ws as unknown as WebSocket,
      serializedHTTPRequest as unknown as IncomingMessage,
      context,
    );
  }

  async onSocketMessage(
    ws: BaseWebSocket,
    serializedHTTPRequest: SerializedHTTPRequest,
    detachableMsg: ArrayBuffer,
  ) {
    // @ts-ignore
    const message = new Uint8Array(detachableMsg.slice());
    const tmpMsg = new SocketIncomingMessage(detachableMsg);
    const documentName = readVarString(tmpMsg.decoder);
    const isDocLoadedOnInstance = this.instance.documents.has(documentName);

    if (isDocLoadedOnInstance) {
      ws.emit('message', message);
      return;
    }

    const proxyTo = await this.getOrClaimLockThrottled(documentName);
    if (proxyTo && proxyTo !== this.serverId) {
      // another server owns the doc
      const proxyMessage: RSAMessageProxy = {
        serializedHTTPRequest: serializedHTTPRequest,
        replyTo: `${this.msgChannel}:${this.serverId}`,
        message,
        type: 'proxy',
      };
      const msg = this.pack(proxyMessage);
      this.pub.publish(`${this.msgChannel}:${proxyTo}`, msg).catch(() => {});
      return;
    }
    // This server owns the document, but hocuspocus hasn't loaded it yet
    ws.emit('message', message);
  }

  onSocketClose(socketId: string, code?: number, reason?: ArrayBuffer) {
    const socket = this.originSockets[socketId];
    if (!socket) return;
    delete this.originSockets[socketId];
    socket.emit('close', code, reason);
    const msg: RSAMessageCloseProxy = { type: 'closeProxy', socketId };
    this.pub.publish(this.msgChannel, this.pack(msg)).catch(() => {});
  }

  /* Hocuspocus hooks */
  async onConfigure({ instance }: onConfigurePayload) {
    this.instance = instance;
  }

  async onLoadDocument(data: onLoadDocumentPayload) {
    const { documentName } = data;
    // Refresh the lock TTL
    this.maintainLock(documentName);
  }

  async afterUnloadDocument(data: afterUnloadDocumentPayload) {
    const { documentName } = data;
    this.releaseLock(documentName);
    // Broadcast to cluster to immediately remove the cached redis value
    const msg: RSAMessageUnload = { type: 'unload', documentName };
    this.pub.publish(this.msgChannel, this.pack(msg)).catch(() => {});
  }
  async onDestroy() {
    this.pub.disconnect(false);
    this.sub.disconnect(false);
  }
}
