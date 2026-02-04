// Source https://github.com/ueberdosis/hocuspocus/pull/1008 - MIT
import {
  Extension,
  Hocuspocus,
  IncomingMessage,
  afterUnloadDocumentPayload,
  onConfigurePayload,
  onLoadDocumentPayload,
} from '@hocuspocus/server';
import RedisClient from 'ioredis';
import { readVarString } from 'lib0/decoding.js';
import { CollabProxySocket } from './collab-proxy-socket';
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
  priority = 1000;
  private readonly pub: RedisClient;
  private sub: RedisClient;
  private readonly pack: Pack;
  private readonly unpack: Unpack;
  private originSockets: Record<SocketId, BaseWebSocket> = {};
  private locks: Record<DocumentName, NodeJS.Timeout> = {};
  private lockPromises: Record<DocumentName, Promise<ServerId | null>> = {};
  private proxySockets: Record<SocketId, CollabProxySocket> = {};
  private readonly prefix: string;
  private readonly lockPrefix: string;
  private readonly msgChannel: string;
  private readonly serverId: ServerId;
  private readonly customEventTTL: number;
  private readonly lockTTL: number;
  private instance!: Hocuspocus;
  private readonly customEvents: TCE;
  private replyIdCounter: number = 0;
  // @ts-ignore
  private pendingReplies: Record<number, PromiseWithResolvers<any>['resolve']> =
    {};

  constructor(configuration: Configuration<TCE>) {
    const {
      redis,
      pack,
      unpack,
      serverId,
      lockTTL,
      prefix,
      customEvents,
      customEventTTL,
    } = configuration;
    this.pub = redis.duplicate();
    this.sub = redis.duplicate();
    this.pack = pack;
    this.unpack = unpack;
    this.serverId = serverId;
    this.lockTTL = lockTTL ?? 10_000;
    this.customEventTTL = customEventTTL ?? 30_000;
    this.prefix = prefix ?? 'collab';
    this.lockPrefix = `${this.prefix}Lock`;
    this.msgChannel = `${this.prefix}Msg`;
    this.customEvents = (customEvents as any) ?? ({} as any as CustomEvents);
    this.sub.subscribe(this.msgChannel, `${this.msgChannel}:${this.serverId}`);
    this.sub.on('messageBuffer', this.handleRedisMessage);
    this.pub.on('error', () => {});
    this.sub.on('error', () => {});
  }
  private getKey(documentName: string) {
    return `${this.lockPrefix}:${documentName}`;
  }

  private closeProxy(socketId: string) {
    const proxySocket = this.proxySockets[socketId];
    if (proxySocket) {
      proxySocket.emit(
        'close',
        1000,
        Buffer.from('provider_initiated', 'utf-8'),
      );
      delete this.proxySockets[socketId];
    }
  }

  private pongProxy(socketId: string) {
    this.proxySockets[socketId]?.emit('pong');
  }

  private handleProxyMessage(
    msg: Pick<RSAMessageProxy, 'replyTo' | 'message' | 'serializedHTTPRequest'>,
  ) {
    const { replyTo, message, serializedHTTPRequest } = msg;
    const { headers } = serializedHTTPRequest;
    const socketId = headers['sec-websocket-key']!;
    let socket = this.proxySockets[socketId];
    if (!socket) {
      socket = new CollabProxySocket(
        this.pub,
        this.pack,
        replyTo,
        `${this.msgChannel}:${this.serverId}`,
        socketId,
      );
      this.proxySockets[socketId] = socket;
      this.instance.handleConnection(
        socket as any,
        serializedHTTPRequest as any,
        {},
      );
    }
    socket.emit('message', message);
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
    if (type === 'pong') {
      this.pongProxy(msg.socketId);
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
      this.pub.publish(`${replyTo}`, this.pack(reply));
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
    const { socketId } = msg;
    const socket = this.originSockets[socketId];
    if (!socket) {
      // origin socket already cleaned up
      return;
    }
    if (type === 'close') {
      socket.close(msg.code, msg.reason);
    } else if (type === 'ping') {
      // Reply instantly to the proxy socket, without forwarding to client
      // The origin socket handles heartbeat for itself
      const { replyTo, socketId } = msg;
      const reply: RSAMessagePong = {
        type: 'pong',
        socketId,
      };
      this.pub.publish(`${replyTo}`, this.pack(reply));
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
    payload: any,
  ) {
    const handler = this.customEvents[eventName];
    if (!handler) throw new Error(`Invalid eventName: ${eventName}`);
    const result = await handler(documentName, payload);
    return result as Promise<ReturnType<TCE[TName]>>;
  }

  async handleEvent<TName extends Extract<keyof TCE, string>>(
    eventName: TName,
    documentName: string,
    payload: any,
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
      this.pub.publish(`${this.msgChannel}:${proxyTo}`, msg);
      // @ts-ignore
      const { promise, resolve, reject } = Promise.withResolvers();
      this.pendingReplies[replyId] = resolve;
      setTimeout(() => {
        reject('TIMEOUT');
      }, this.customEventTTL);
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
    const socketId = serializedHTTPRequest.headers['sec-websocket-key']!;
    this.originSockets[socketId] = ws;
    this.instance.handleConnection(
      ws as any,
      serializedHTTPRequest as any,
      context,
    );
  }

  async onSocketMessage(
    ws: BaseWebSocket,
    serializedHTTPRequest: SerializedHTTPRequest,
    detachableMsg: ArrayBuffer,
  ) {
    const message = new Uint8Array(detachableMsg.slice());
    const tmpMsg = new IncomingMessage(detachableMsg);
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
      this.pub.publish(`${this.msgChannel}:${proxyTo}`, msg);
      return;
    }
    // This server owns the document, but hocuspocus hasn't loaded it yet
    ws.emit('message', message);
  }

  onSocketClose(socketId: string, code?: number, reason?: ArrayBuffer) {
    const socket = this.originSockets[socketId];
    if (!socket) return;
    // at this point the socket is considered GC'd and we cannot call close
    // The origin socket did not set up any connections for the proxy, so none of the hooks will work if we just emit
    socket?.emit('close', code, reason);
    delete this.originSockets[socketId];
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
    this.pub.publish(this.msgChannel, this.pack(msg));
  }

  async onDestroy() {
    this.pub.disconnect(false);
    this.sub.disconnect(false);
  }
}
