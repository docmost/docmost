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
var CollaborationModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationModule = void 0;
const common_1 = require("@nestjs/common");
const authentication_extension_1 = require("./extensions/authentication.extension");
const persistence_extension_1 = require("./extensions/persistence.extension");
const collaboration_gateway_1 = require("./collaboration.gateway");
const core_1 = require("@nestjs/core");
const collab_ws_adapter_1 = require("./adapter/collab-ws.adapter");
const token_module_1 = require("../core/auth/token.module");
const history_processor_1 = require("./processors/history.processor");
const logger_extension_1 = require("./extensions/logger.extension");
const collaboration_handler_1 = require("./collaboration.handler");
const collab_history_service_1 = require("./services/collab-history.service");
const watcher_module_1 = require("../core/watcher/watcher.module");
const transclusion_service_1 = require("../core/page/transclusion/transclusion.service");
const transclusion_module_1 = require("../core/page/transclusion/transclusion.module");
const storage_module_1 = require("../integrations/storage/storage.module");
const environment_module_1 = require("../integrations/environment/environment.module");
let CollaborationModule = CollaborationModule_1 = class CollaborationModule {
    constructor(collaborationGateway, httpAdapterHost) {
        this.collaborationGateway = collaborationGateway;
        this.httpAdapterHost = httpAdapterHost;
        this.logger = new common_1.Logger(CollaborationModule_1.name);
        this.path = '/collab';
    }
    onModuleInit() {
        this.collabWsAdapter = new collab_ws_adapter_1.CollabWsAdapter();
        const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
        const wss = this.collabWsAdapter.handleUpgrade(this.path, httpServer);
        wss.on('connection', (client, request) => {
            this.collaborationGateway.handleConnection(client, request);
            client.on('error', (error) => {
                this.logger.error('WebSocket client error:', error);
            });
        });
        wss.on('error', (error) => this.logger.error('WebSocket server error:', error));
    }
    async onModuleDestroy() {
        await this.collaborationGateway?.destroy(this.collabWsAdapter);
        this.collabWsAdapter?.destroy();
    }
};
exports.CollaborationModule = CollaborationModule;
exports.CollaborationModule = CollaborationModule = CollaborationModule_1 = __decorate([
    (0, common_1.Module)({
        providers: [
            collaboration_gateway_1.CollaborationGateway,
            authentication_extension_1.AuthenticationExtension,
            persistence_extension_1.PersistenceExtension,
            logger_extension_1.LoggerExtension,
            history_processor_1.HistoryProcessor,
            collab_history_service_1.CollabHistoryService,
            collaboration_handler_1.CollaborationHandler,
            transclusion_service_1.TransclusionService,
        ],
        exports: [collaboration_gateway_1.CollaborationGateway],
        imports: [
            token_module_1.TokenModule,
            watcher_module_1.WatcherModule,
            storage_module_1.StorageModule.forRootAsync({
                imports: [environment_module_1.EnvironmentModule],
            }),
            transclusion_module_1.TransclusionModule,
        ],
    }),
    __metadata("design:paramtypes", [collaboration_gateway_1.CollaborationGateway,
        core_1.HttpAdapterHost])
], CollaborationModule);
//# sourceMappingURL=collaboration.module.js.map