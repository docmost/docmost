"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const environment_service_1 = require("./integrations/environment/environment.service");
const audit_actor_interceptor_1 = require("./common/interceptors/audit-actor.interceptor");
const core_module_1 = require("./core/core.module");
const environment_module_1 = require("./integrations/environment/environment.module");
const collaboration_module_1 = require("./collaboration/collaboration.module");
const ws_module_1 = require("./ws/ws.module");
const database_module_1 = require("./database/database.module");
const storage_module_1 = require("./integrations/storage/storage.module");
const mail_module_1 = require("./integrations/mail/mail.module");
const queue_module_1 = require("./integrations/queue/queue.module");
const static_module_1 = require("./integrations/static/static.module");
const event_emitter_1 = require("@nestjs/event-emitter");
const health_module_1 = require("./integrations/health/health.module");
const export_module_1 = require("./integrations/export/export.module");
const import_module_1 = require("./integrations/import/import.module");
const security_module_1 = require("./integrations/security/security.module");
const telemetry_module_1 = require("./integrations/telemetry/telemetry.module");
const nestjs_ioredis_1 = require("@nestjs-labs/nestjs-ioredis");
const redis_config_service_1 = require("./integrations/redis/redis-config.service");
const cache_manager_1 = require("@nestjs/cache-manager");
const redis_1 = require("@keyv/redis");
const logger_module_1 = require("./common/logger/logger.module");
const nestjs_cls_1 = require("nestjs-cls");
const audit_module_1 = require("./integrations/audit/audit.module");
const throttle_module_1 = require("./integrations/throttle/throttle.module");
const enterpriseModules = [];
try {
    if (require('./ee/ee.module')?.EeModule) {
        enterpriseModules.push(require('./ee/ee.module')?.EeModule);
    }
}
catch (err) {
    if (process.env.CLOUD === 'true') {
        console.warn('Failed to load enterprise modules. Exiting program.\n', err);
        process.exit(1);
    }
}
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            nestjs_cls_1.ClsModule.forRoot({
                global: true,
                middleware: { mount: true },
            }),
            logger_module_1.LoggerModule,
            audit_module_1.NoopAuditModule,
            core_module_1.CoreModule,
            database_module_1.DatabaseModule,
            environment_module_1.EnvironmentModule,
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
            collaboration_module_1.CollaborationModule,
            ws_module_1.WsModule,
            queue_module_1.QueueModule,
            static_module_1.StaticModule,
            health_module_1.HealthModule,
            import_module_1.ImportModule,
            export_module_1.ExportModule,
            storage_module_1.StorageModule.forRootAsync({
                imports: [environment_module_1.EnvironmentModule],
            }),
            mail_module_1.MailModule.forRootAsync({
                imports: [environment_module_1.EnvironmentModule],
            }),
            event_emitter_1.EventEmitterModule.forRoot(),
            security_module_1.SecurityModule,
            telemetry_module_1.TelemetryModule,
            throttle_module_1.ThrottleModule,
            ...enterpriseModules,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: audit_actor_interceptor_1.AuditActorInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map