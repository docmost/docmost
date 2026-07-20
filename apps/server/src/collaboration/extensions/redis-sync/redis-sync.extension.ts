// Source https://github.com/ueberdosis/hocuspocus/pull/1008 - MIT
import {
  Extension,
  Hocuspocus,
  IncomingMessage,
  onConfigurePayload,
  onLoadDocumentPayload,
  afterUnloadDocumentPayload,
  WebSocketLike,
} from '@hocuspocus/server';
import { ConnectionTimeout, Unauthorized } from '@hocuspocus/common';
import RedisClient from 'ioredis';
import { CollabProxySocket } from './collab-proxy-socket';
import {
  Configuration,
  CustomEvents,
  Pack,
  RSAMessage,
  RSAMessageClose,
  RSAMessageCloseProxy,
  RSAMessageCustomEventComplete,
  RSAMessageCustomEventStart,
  RSAMessageProxy,
  RSAMessageUnload,
  SerializedHTTPRequest,
  Unpack,
  OriginConnection,
  ProxyConnection,
  toWebRequest,
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
  private originConnections: Record<SocketId, OriginConnection> = {};
  private locks: Record<DocumentName, NodeJS.Timeout> = {};
  private lockPromises: Record<DocumentName, Promise<ServerId | null>> = {};
  private proxyConnections: Record<SocketId, ProxyConnection> = {};
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
  private deriveContext: (
    serializedHTTPRequest: SerializedHTTPRequest,
  ) => Record<string, any>;

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
      deriveContext,
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
    this.deriveContext = deriveContext ?? (() => ({}));
    this.sub.subscribe(this.msgChannel, `${this.msgChannel}:${this.serverId}`);
    this.sub.on('messageBuffer', this.handleRedisMessage);
    this.pub.on('error', () => {});
    this.sub.on('error', () => {});
  }
  private getKey(documentName: string) {
    return `${this.lockPrefix}:${documentName}`;
  }

  private closeProxy(socketId: string) {
    const entry = this.proxyConnections[socketId];
    if (entry) {
      delete this.proxyConnections[socketId];
      const { socket, clientConnection } = entry;
      // The origin socket is already gone; don't echo a close message back
      socket.markClosed();
      clientConnection.handleClose({
        code: 1000,
        reason: 'provider_initiated',
      });
    }
  }

  private handleProxyMessage(
    msg: Pick<RSAMessageProxy, 'replyTo' | 'message' | 'serializedHTTPRequest'>,
  ) {
    const { replyTo, message, serializedHTTPRequest } = msg;
    const { headers } = serializedHTTPRequest;
    const socketId = headers['sec-websocket-key'];
    let entry = this.proxyConnections[socketId];
    if (!entry) {
      const socket = new CollabProxySocket(
        this.pub,
        this.pack,
        replyTo,
        socketId,
      );
      // A proxy connection with no live documents (client left the page, auth
      // failed, or the origin server crashed) is reaped by hocuspocus' message
      // timeout. Dispose it silently in that case: relaying the timeout close
      // to the origin would kill the client's real socket, which may be busy
      // serving other documents. Genuine protocol closes are still relayed.
      socket.onClose = (code, reason) => {
        delete this.proxyConnections[socketId];
        if (code !== ConnectionTimeout.code) {
          const msg: RSAMessageClose = {
            type: 'close',
            code,
            reason,
            socketId,
          };
          this.pub.publish(replyTo, this.pack(msg));
        }
      };
      const clientConnection = this.instance.handleConnection(
        socket,
        toWebRequest(serializedHTTPRequest),
        this.deriveContext(serializedHTTPRequest),
      );
      entry = { clientConnection, socket };
      this.proxyConnections[socketId] = entry;
    }
    entry.clientConnection.handleMessage(message);
  }

  private getLock(documentName: string) {
    return this.pub.get(this.getKey(documentName));
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
    const entry = this.originConnections[socketId];
    if (!entry) {
      // origin socket already cleaned up
      return;
    }
    const { socket } = entry;
    if (type === 'close') {
      socket.close(msg.code, msg.reason);
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
    // if true, don't claim the lock. Useful for targeting pages that are currently open
    onlyIfOpen = false,
  ) {
    const isDocLoadedOnInstance = this.instance.documents.has(documentName);

    if (isDocLoadedOnInstance) {
      return this.handleEventLocally(eventName, documentName, payload);
    }

    const proxyTo = await (onlyIfOpen
      ? this.getLock(documentName)
      : this.getOrClaimLockThrottled(documentName));

    if (!proxyTo && onlyIfOpen) {
      return;
    }

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
        delete this.pendingReplies[replyId];
        reject(new Error('TIMEOUT'));
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
    ws: WebSocketLike,
    serializedHTTPRequest: SerializedHTTPRequest,
  ) {
    const socketId = serializedHTTPRequest.headers['sec-websocket-key'];
    const clientConnection = this.instance.handleConnection(
      ws,
      toWebRequest(serializedHTTPRequest),
      this.deriveContext(serializedHTTPRequest),
    );
    this.originConnections[socketId] = { clientConnection, socket: ws };
  }

  async onSocketMessage(
    serializedHTTPRequest: SerializedHTTPRequest,
    detachableMsg: ArrayBuffer,
  ) {
    const socketId = serializedHTTPRequest.headers['sec-websocket-key'];
    const entry = this.originConnections[socketId];
    if (!entry) return;
    const { clientConnection } = entry;

    let message: Uint8Array;
    let documentName: string;
    try {
      message = new Uint8Array(detachableMsg.slice());
      const tmpMsg = new IncomingMessage(detachableMsg);
      const documentNameAndSessionId = tmpMsg.readVarString();
      // session-aware providers suffix the documentName with \0sessionId
      const sepIdx = documentNameAndSessionId.indexOf('\0');
      documentName =
        sepIdx === -1
          ? documentNameAndSessionId
          : documentNameAndSessionId.slice(0, sepIdx);
    } catch (error) {
      entry.socket.close(Unauthorized.code, Unauthorized.reason);
      return;
    }
    const isDocLoadedOnInstance = this.instance.documents.has(documentName);

    if (isDocLoadedOnInstance) {
      clientConnection.handleMessage(message);
      return;
    }

    const proxyTo = await this.getOrClaimLockThrottled(documentName);
    if (proxyTo && proxyTo !== this.serverId) {
      // Proxied messages bypass handleMessage, so refresh the connection's
      // liveness fields manually or hocuspocus' message timeout would reap the
      // real socket every `timeout` ms. connectionEstablishedAt is the
      // reference while unauthenticated (auth for remote docs is proxied too)
      // and is private upstream.
      clientConnection.lastMessageReceivedAt = Date.now();
      (clientConnection as any).connectionEstablishedAt = Date.now();
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
    clientConnection.handleMessage(message);
  }

  onSocketClose(socketId: string, code?: number, reason?: ArrayBuffer) {
    const entry = this.originConnections[socketId];
    if (!entry) return;
    delete this.originConnections[socketId];
    entry.clientConnection.handleClose({
      code: code ?? 1000,
      reason: reason ? Buffer.from(reason).toString() : '',
    });
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
    this.pendingReplies = {};
    this.pub.disconnect(false);
    this.sub.disconnect(false);
  }
}
