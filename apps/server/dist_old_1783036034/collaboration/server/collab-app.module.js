"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollabAppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("../../app.controller");
const app_service_1 = require("../../app.service");
const environment_module_1 = require("../../integrations/environment/environment.module");
const environment_service_1 = require("../../integrations/environment/environment.service");
const collaboration_module_1 = require("../collaboration.module");
const database_module_1 = require("../../database/database.module");
const queue_module_1 = require("../../integrations/queue/queue.module");
const event_emitter_1 = require("@nestjs/event-emitter");
const health_module_1 = require("../../integrations/health/health.module");
const collaboration_controller_1 = require("./collaboration.controller");
const logger_module_1 = require("../../common/logger/logger.module");
const nestjs_ioredis_1 = require("@nestjs-labs/nestjs-ioredis");
const redis_config_service_1 = require("../../integrations/redis/redis-config.service");
const casl_module_1 = require("../../core/casl/casl.module");
const cache_manager_1 = require("@nestjs/cache-manager");
const redis_1 = require("@keyv/redis");
let CollabAppModule = class CollabAppModule {
};
exports.CollabAppModule = CollabAppModule;
exports.CollabAppModule = CollabAppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            logger_module_1.LoggerModule,
            database_module_1.DatabaseModule,
            environment_module_1.EnvironmentModule,
            casl_module_1.CaslModule,
            collaboration_module_1.CollaborationModule,
            queue_module_1.QueueModule,
            health_module_1.HealthModule,
            event_emitter_1.EventEmitterModule.forRoot(),
            nestjs_ioredis_1.RedisModule.forRootAsync({
                useClass: redis_config_service_1.RedisConfigService,
            }),
            cache_manager_1.CacheModule.registerAsync({
                isGlobal: true,
                useFactory: async (environmentService) => {
                    const redisUrl = environmentService.getRedisUrl();
                    return {
                        ttl: 5 * 1000,
                        stores: [new redis_1.default(redisUrl)],
                    };
                },
                inject: [environment_service_1.EnvironmentService],
            }),
        ],
        controllers: [
            app_controller_1.AppController,
            ...(process.env.COLLAB_SHOW_STATS?.toLowerCase() === 'true'
                ? [collaboration_controller_1.CollaborationController]
                : []),
        ],
        providers: [app_service_1.AppService],
    })
], CollabAppModule);
//# sourceMappingURL=collab-app.module.js.map