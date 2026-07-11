"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThrottleModule = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const throttler_storage_redis_1 = require("@nest-lab/throttler-storage-redis");
const environment_service_1 = require("../environment/environment.service");
const environment_module_1 = require("../environment/environment.module");
const helpers_1 = require("../../common/helpers");
const throttler_names_1 = require("./throttler-names");
const ioredis_1 = require("ioredis");
let ThrottleModule = class ThrottleModule {
};
exports.ThrottleModule = ThrottleModule;
exports.ThrottleModule = ThrottleModule = __decorate([
    (0, common_1.Module)({
        imports: [
            throttler_1.ThrottlerModule.forRootAsync({
                imports: [environment_module_1.EnvironmentModule],
                useFactory: (environmentService) => {
                    const redisConfig = (0, helpers_1.parseRedisUrl)(environmentService.getRedisUrl());
                    return {
                        throttlers: [
                            { name: throttler_names_1.AUTH_THROTTLER, ttl: 60_000, limit: 10 },
                            { name: throttler_names_1.AI_CHAT_THROTTLER, ttl: 60_000, limit: 25 },
                        ],
                        errorMessage: 'Too many requests',
                        storage: new throttler_storage_redis_1.ThrottlerStorageRedisService(new ioredis_1.default({
                            host: redisConfig.host,
                            port: redisConfig.port,
                            password: redisConfig.password,
                            db: redisConfig.db,
                            family: redisConfig.family,
                            keyPrefix: 'throttle:',
                        })),
                    };
                },
                inject: [environment_service_1.EnvironmentService],
            }),
        ],
    })
], ThrottleModule);
//# sourceMappingURL=throttle.module.js.map