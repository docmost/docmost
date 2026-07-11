"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisSyncExtension = void 0;
const server_1 = require("@hocuspocus/server");
const decoding_js_1 = require("lib0/decoding.js");
const collab_proxy_socket_1 = require("./collab-proxy-socket");
class RedisSyncExtension {
    constructor(configuration) {
        this.priority = 1000;
        this.originSockets = {};
        this.locks = {};
        this.lockPromises = {};
        this.proxySockets = {};
        this.replyIdCounter = 0;
        this.pendingReplies = {};
        this.handleRedisMessage = async (_channel, packedMessage) => {
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
                const res = await this.handleEventLocally(eventName, documentName, payload);
                const reply = {
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
                if (!resolveFn)
                    return;
                delete this.pendingReplies[replyId];
                resolveFn(payload);
                return;
            }
            const { socketId } = msg;
            const socket = this.originSockets[socketId];
            if (!socket) {
                return;
            }
            if (type === 'close') {
                socket.close(msg.code, msg.reason);
            }
            else if (type === 'ping') {
                const { replyTo, socketId } = msg;
                const reply = {
                    type: 'pong',
                    socketId,
                };
                this.pub.publish(`${replyTo}`, this.pack(reply));
            }
            else if (type === 'send') {
                socket.send(msg.message);
            }
        };
        const { redis, pack, unpack, serverId, lockTTL, prefix, customEvents, customEventTTL, } = configuration;
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
        this.customEvents = customEvents ?? {};
        this.sub.subscribe(this.msgChannel, `${this.msgChannel}:${this.serverId}`);
        this.sub.on('messageBuffer', this.handleRedisMessage);
        this.pub.on('error', () => { });
        this.sub.on('error', () => { });
    }
    getKey(documentName) {
        return `${this.lockPrefix}:${documentName}`;
    }
    closeProxy(socketId) {
        const proxySocket = this.proxySockets[socketId];
        if (proxySocket) {
            proxySocket.emit('close', 1000, Buffer.from('provider_initiated', 'utf-8'));
            delete this.proxySockets[socketId];
        }
    }
    pongProxy(socketId) {
        this.proxySockets[socketId]?.emit('pong');
    }
    handleProxyMessage(msg) {
        const { replyTo, message, serializedHTTPRequest } = msg;
        const { headers } = serializedHTTPRequest;
        const socketId = headers['sec-websocket-key'];
        let socket = this.proxySockets[socketId];
        if (!socket) {
            socket = new collab_proxy_socket_1.CollabProxySocket(this.pub, this.pack, replyTo, `${this.msgChannel}:${this.serverId}`, socketId);
            this.proxySockets[socketId] = socket;
            this.instance.handleConnection(socket, serializedHTTPRequest, {});
        }
        socket.emit('message', message);
    }
    getOrClaimLock(documentName) {
        const lockPromise = this.pub.set(this.getKey(documentName), this.serverId, 'PX', this.lockTTL, 'NX', 'GET');
        this.lockPromises[documentName] = lockPromise;
        setTimeout(() => {
            delete this.lockPromises[documentName];
        }, this.lockTTL / 2);
        return lockPromise;
    }
    getOrClaimLockThrottled(documentName) {
        const existingWorkerIdPromise = this.lockPromises[documentName];
        if (existingWorkerIdPromise)
            return existingWorkerIdPromise;
        return this.getOrClaimLock(documentName);
    }
    async maintainLock(documentName) {
        this.locks[documentName] = setInterval(() => {
            this.pub.set(this.getKey(documentName), this.serverId, 'PX', this.lockTTL);
        }, this.lockTTL / 2);
    }
    async releaseLock(documentName) {
        clearInterval(this.locks[documentName]);
        delete this.locks[documentName];
        return this.pub.del(this.getKey(documentName));
    }
    async handleEventLocally(eventName, documentName, payload) {
        const handler = this.customEvents[eventName];
        if (!handler)
            throw new Error(`Invalid eventName: ${eventName}`);
        const result = await handler(documentName, payload);
        return result;
    }
    async handleEvent(eventName, documentName, payload) {
        const isDocLoadedOnInstance = this.instance.documents.has(documentName);
        if (isDocLoadedOnInstance) {
            return this.handleEventLocally(eventName, documentName, payload);
        }
        const proxyTo = await this.getOrClaimLockThrottled(documentName);
        if (proxyTo && proxyTo !== this.serverId) {
            ++this.replyIdCounter;
            const replyId = this.replyIdCounter;
            const proxyMessage = {
                eventName,
                documentName,
                payload,
                replyTo: `${this.msgChannel}:${this.serverId}`,
                replyId,
                type: 'customEventStart',
            };
            const msg = this.pack(proxyMessage);
            this.pub.publish(`${this.msgChannel}:${proxyTo}`, msg);
            const { promise, resolve, reject } = Promise.withResolvers();
            this.pendingReplies[replyId] = resolve;
            setTimeout(() => {
                reject('TIMEOUT');
            }, this.customEventTTL);
            return promise;
        }
        return this.handleEventLocally(eventName, documentName, payload);
    }
    async lockDocument(documentName) {
        const proxyTo = await this.getOrClaimLockThrottled(documentName);
        if (proxyTo && proxyTo !== this.serverId) {
            throw new Error(`Could not lock document: ${documentName}`);
        }
        this.maintainLock(documentName);
        return () => this.releaseLock(documentName);
    }
    onSocketOpen(ws, serializedHTTPRequest, context = {}) {
        const socketId = serializedHTTPRequest.headers['sec-websocket-key'];
        this.originSockets[socketId] = ws;
        this.instance.handleConnection(ws, serializedHTTPRequest, context);
    }
    async onSocketMessage(ws, serializedHTTPRequest, detachableMsg) {
        const message = new Uint8Array(detachableMsg.slice());
        const tmpMsg = new server_1.IncomingMessage(detachableMsg);
        const documentName = (0, decoding_js_1.readVarString)(tmpMsg.decoder);
        const isDocLoadedOnInstance = this.instance.documents.has(documentName);
        if (isDocLoadedOnInstance) {
            ws.emit('message', message);
            return;
        }
        const proxyTo = await this.getOrClaimLockThrottled(documentName);
        if (proxyTo && proxyTo !== this.serverId) {
            const proxyMessage = {
                serializedHTTPRequest: serializedHTTPRequest,
                replyTo: `${this.msgChannel}:${this.serverId}`,
                message,
                type: 'proxy',
            };
            const msg = this.pack(proxyMessage);
            this.pub.publish(`${this.msgChannel}:${proxyTo}`, msg);
            return;
        }
        ws.emit('message', message);
    }
    onSocketClose(socketId, code, reason) {
        const socket = this.originSockets[socketId];
        if (!socket)
            return;
        socket?.emit('close', code, reason);
        delete this.originSockets[socketId];
        const msg = { type: 'closeProxy', socketId };
        this.pub.publish(this.msgChannel, this.pack(msg)).catch(() => { });
    }
    async onConfigure({ instance }) {
        this.instance = instance;
    }
    async onLoadDocument(data) {
        const { documentName } = data;
        this.maintainLock(documentName);
    }
    async afterUnloadDocument(data) {
        const { documentName } = data;
        this.releaseLock(documentName);
        const msg = { type: 'unload', documentName };
        this.pub.publish(this.msgChannel, this.pack(msg));
    }
    async onDestroy() {
        this.pub.disconnect(false);
        this.sub.disconnect(false);
    }
}
exports.RedisSyncExtension = RedisSyncExtension;
//# sourceMappingURL=redis-sync.extension.js.map