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
exports.RedisConfigService = void 0;
const common_1 = require("@nestjs/common");
const helpers_1 = require("../../common/helpers");
const environment_service_1 = require("../environment/environment.service");
let RedisConfigService = class RedisConfigService {
    constructor(environmentService) {
        this.environmentService = environmentService;
    }
    createRedisOptions() {
        const redisConfig = (0, helpers_1.parseRedisUrl)(this.environmentService.getRedisUrl());
        return {
            readyLog: true,
            config: {
                host: redisConfig.host,
                port: redisConfig.port,
                password: redisConfig.password,
                db: redisConfig.db,
                family: redisConfig.family,
                retryStrategy: (0, helpers_1.createRetryStrategy)(),
            },
        };
    }
};
exports.RedisConfigService = RedisConfigService;
exports.RedisConfigService = RedisConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [environment_service_1.EnvironmentService])
], RedisConfigService);
//# sourceMappingURL=redis-config.service.js.map