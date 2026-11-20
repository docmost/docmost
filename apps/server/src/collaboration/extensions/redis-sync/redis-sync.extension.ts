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
import { HttpException, Logger } from '@nestjs/common';
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
  RSAMessageCustomEventError,
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
type PendingReply = {
  resolve: (payload: any) => void;
  reject: (err: Error) => void;
};

export class RedisSyncExtension<TCE extends CustomEvents> implements Extension {
  priority = 1000;
  private readonly logger = new Logger(RedisSyncExtension.name);
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
  private readonly pendingReplies = new Map<number, PendingReply>();
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
    this.sub = redis.duplicate({ lazyConnect: false, autoResubscribe: false });
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
    this.pub.on('error', (err) =>
      this.logger.error({ err }, 'Collaboration Redis publisher failed'),
    );
    this.sub.on('error', (err) =>
      this.logger.error({ err }, 'Collaboration Redis subscriber failed'),
    );
    this.sub.on('messageBuffer', (channel: Buffer, data: Buffer) =>
      this.handleRedisMessage(data).catch((err) =>
        this.logger.error(
          { err, channel: channel.toString() },
          'Failed to handle collaboration message',
        ),
      ),
    );
    // A subscription that failed during startup must also be restored on reconnect.
    this.sub.on('ready', () => {
      this.sub
        .subscribe(this.msgChannel, `${this.msgChannel}:${this.serverId}`)
        .catch((err) =>
          this.logger.error({ err }, 'Failed to subscribe to collaboration channels'),
        );
    });
  }

  private getKey(documentName: string) {
    return `${this.lockPrefix}:${documentName}`;
  }

  private async publish(channel: string, message: RSAMessage) {
    return this.pub.publish(channel, this.pack(message));
  }

  private publishInBackground(channel: string, message: RSAMessage) {
    this.publish(channel, message).catch((err) =>
      this.logger.error(
        { err, channel, type: message.type },
        'Failed to publish collaboration message',
      ),
    );
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
      const socket = new CollabProxySocket(socketId, (msg) =>
        this.publishInBackground(replyTo, msg),
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
          this.publishInBackground(replyTo, msg);
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

  private async handleRedisMessage(packedMessage: Buffer) {
    const msg = this.unpack(packedMessage);
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
      let reply: RSAMessageCustomEventComplete | RSAMessageCustomEventError;
      try {
        const result = await this.handleEventLocally(
          eventName as Extract<keyof TCE, string>,
          documentName,
          payload,
        );
        reply = { type: 'customEventComplete', replyId, payload: result };
      } catch (err) {
        let error: RSAMessageCustomEventError['error'];
        if (err instanceof HttpException) {
          error = { status: err.getStatus(), response: err.getResponse() };
        } else {
          this.logger.error(
            { err, eventName, documentName },
            'Collaboration operation failed on owner',
          );
          error = { message: err instanceof Error ? err.message : String(err) };
        }
        reply = { type: 'customEventError', replyId, error };
      }
      await this.publish(replyTo, reply);
      return;
    }
    if (type === 'customEventComplete' || type === 'customEventError') {
      const pending = this.pendingReplies.get(msg.replyId);
      if (!pending) return;
      if (type === 'customEventComplete') {
        pending.resolve(msg.payload);
      } else {
        const { error } = msg;
        pending.reject(
          'status' in error
            ? new HttpException(error.response, error.status)
            : new Error(error.message),
        );
      }
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
  }

  async maintainLock(documentName: string) {
    clearInterval(this.locks[documentName]);
    this.locks[documentName] = setInterval(() => {
      this.pub
        .set(this.getKey(documentName), this.serverId, 'PX', this.lockTTL)
        .catch((err) =>
          this.logger.error({ err, documentName }, 'Failed to renew collaboration lock'),
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
      const replyId = ++this.replyIdCounter;
      // another server owns the doc
      const proxyMessage: RSAMessageCustomEventStart = {
        eventName,
        documentName,
        payload,
        replyTo: `${this.msgChannel}:${this.serverId}`,
        replyId,
        type: 'customEventStart',
      };
      let timeout: NodeJS.Timeout;
      try {
        return await new Promise<Awaited<ReturnType<TCE[TName]>>>(
          (resolve, reject) => {
            this.pendingReplies.set(replyId, { resolve, reject });
            timeout = setTimeout(() => reject(new Error('TIMEOUT')), this.customEventTTL);
            this.publish(`${this.msgChannel}:${proxyTo}`, proxyMessage).catch(reject);
          },
        );
      } finally {
        clearTimeout(timeout);
        this.pendingReplies.delete(replyId);
      }
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
    detachableMsg: ArrayBuffer | Uint8Array,
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
      // Forwarded traffic bypasses handleMessage on this node.
      clientConnection.touch();
      // The owner authenticates remote documents, so a proxy-only socket also
      // needs its local pre-authentication deadline refreshed.
      (clientConnection as any).connectionEstablishedAt = Date.now();
      // another server owns the doc
      const proxyMessage: RSAMessageProxy = {
        serializedHTTPRequest: serializedHTTPRequest,
        replyTo: `${this.msgChannel}:${this.serverId}`,
        message,
        type: 'proxy',
      };
      await this.publish(`${this.msgChannel}:${proxyTo}`, proxyMessage);
      return;
    }
    // This server owns the document, but hocuspocus hasn't loaded it yet
    clientConnection.handleMessage(message);
  }

  onSocketClose(socketId: string, code?: number, reason?: ArrayBuffer) {
    const entry = this.originConnections[socketId];
    if (!entry) return;
    delete this.originConnections[socketId];
    try {
      entry.clientConnection.handleClose({
        code: code ?? 1000,
        reason: reason ? Buffer.from(reason).toString() : '',
      });
    } finally {
      const msg: RSAMessageCloseProxy = { type: 'closeProxy', socketId };
      this.publishInBackground(this.msgChannel, msg);
    }
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
    this.releaseLock(documentName).catch((err) =>
      this.logger.error({ err, documentName }, 'Failed to release collaboration lock'),
    );
    // Broadcast to cluster to immediately remove the cached redis value
    const msg: RSAMessageUnload = { type: 'unload', documentName };
    this.publishInBackground(this.msgChannel, msg);
  }

  async onDestroy() {
    for (const reply of this.pendingReplies.values()) {
      reply.reject(new Error('Collaboration relay stopped'));
    }
    this.pub.disconnect(false);
    this.sub.disconnect(false);
  }
}
