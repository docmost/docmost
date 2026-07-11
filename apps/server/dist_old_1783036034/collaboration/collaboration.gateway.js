"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationGateway = void 0;
const server_1 = require("@hocuspocus/server");
const authentication_extension_1 = require("./extensions/authentication.extension");
const persistence_extension_1 = require("./extensions/persistence.extension");
const common_1 = require("@nestjs/common");
const environment_service_1 = require("../integrations/environment/environment.service");
const helpers_1 = require("../common/helpers");
const logger_extension_1 = require("./extensions/logger.extension");
const redis_sync_1 = require("./extensions/redis-sync");
const ws_socket_wrapper_1 = require("./extensions/redis-sync/ws-socket-wrapper");
const ioredis_1 = require("ioredis");
const msgpackr_1 = require("msgpackr");
const nanoid_1 = require("nanoid");
const os = require("node:os");
const collaboration_handler_1 = require("./collaboration.handler");
let CollaborationGateway = class CollaborationGateway {
    constructor(authenticationExtension, persistenceExtension, loggerExtension, environmentService, collabEventsService) {
        this.authenticationExtension = authenticationExtension;
        this.persistenceExtension = persistenceExtension;
        this.loggerExtension = loggerExtension;
        this.environmentService = environmentService;
        this.collabEventsService = collabEventsService;
        this.redisSync = null;
        this.redisConfig = (0, helpers_1.parseRedisUrl)(this.environmentService.getRedisUrl());
        this.withRedis = !this.environmentService.isCollabDisableRedis();
        this.hocuspocus = new server_1.Hocuspocus({
            debounce: 10000,
            maxDebounce: 45000,
            unloadImmediately: false,
            extensions: [
                this.authenticationExtension,
                this.persistenceExtension,
                this.loggerExtension,
            ],
        });
        if (this.withRedis) {
            this.redisSync = new redis_sync_1.RedisSyncExtension({
                redis: new ioredis_1.default({
                    host: this.redisConfig.host,
                    port: this.redisConfig.port,
                    password: this.redisConfig.password,
                    db: this.redisConfig.db,
                    family: this.redisConfig.family,
                    retryStrategy: (0, helpers_1.createRetryStrategy)(),
                }),
                serverId: `collab-${os?.hostname()}-${(0, nanoid_1.nanoid)(10)}`,
                prefix: 'collab',
                pack: msgpackr_1.pack,
                unpack: msgpackr_1.unpack,
                customEvents: this.collabEventsService.getHandlers(this.hocuspocus),
            });
            this.hocuspocus.configuration.extensions.push(this.redisSync);
            this.redisSync.onConfigure({ instance: this.hocuspocus });
        }
    }
    serializeRequest(request) {
        return {
            method: request.method ?? 'GET',
            url: request.url ?? '/',
            headers: {
                'sec-websocket-key': request.headers['sec-websocket-key'] ?? '',
                'sec-websocket-protocol': request.headers['sec-websocket-protocol'] ?? '',
            },
            socket: { remoteAddress: request.socket?.remoteAddress ?? '' },
        };
    }
    handleConnection(client, request) {
        if (this.redisSync) {
            const serializedHTTPRequest = this.serializeRequest(request);
            const socketId = serializedHTTPRequest.headers['sec-websocket-key'];
            const wrappedSocket = new ws_socket_wrapper_1.WsSocketWrapper(client);
            this.redisSync.onSocketOpen(wrappedSocket, serializedHTTPRequest);
            client.on('message', (data) => {
                this.redisSync.onSocketMessage(wrappedSocket, serializedHTTPRequest, data);
            });
            client.on('close', (code, reason) => {
                this.redisSync.onSocketClose(socketId, code, reason.buffer);
            });
            client.on('pong', (data) => {
                wrappedSocket.emit('pong', data);
            });
        }
        else {
            this.hocuspocus.handleConnection(client, request);
        }
    }
    getConnectionCount() {
        return this.hocuspocus.getConnectionsCount();
    }
    getDocumentCount() {
        return this.hocuspocus.getDocumentsCount();
    }
    handleYjsEvent(eventName, documentName, payload) {
        return this.redisSync?.handleEvent(eventName, documentName, payload);
    }
    openDirectConnection(documentName, context) {
        return this.hocuspocus.openDirectConnection(documentName, context);
    }
    async lockDocument(documentName) {
        return this.redisSync.lockDocument(documentName);
    }
    async releaseLock(documentName) {
        return this.redisSync.releaseLock(documentName);
    }
    async destroy(collabWsAdapter) {
        await new Promise(async (resolve) => {
            try {
                this.hocuspocus.configuration.extensions.push({
                    async afterUnloadDocument({ instance }) {
                        if (instance.getDocumentsCount() === 0)
                            resolve('');
                    },
                });
                collabWsAdapter?.close();
                if (this.hocuspocus.getDocumentsCount() === 0)
                    resolve('');
                this.hocuspocus.closeConnections();
            }
            catch (error) {
                console.error(error);
            }
        });
        await this.hocuspocus.hooks('onDestroy', { instance: this.hocuspocus });
    }
};
exports.CollaborationGateway = CollaborationGateway;
exports.CollaborationGateway = CollaborationGateway = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [authentication_extension_1.AuthenticationExtension,
        persistence_extension_1.PersistenceExtension,
        logger_extension_1.LoggerExtension,
        environment_service_1.EnvironmentService,
        collaboration_handler_1.CollaborationHandler])
], CollaborationGateway);
//# sourceMappingURL=collaboration.gateway.js.map