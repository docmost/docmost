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
var RedisHealthIndicator_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisHealthIndicator = void 0;
const terminus_1 = require("@nestjs/terminus");
const common_1 = require("@nestjs/common");
const environment_service_1 = require("../environment/environment.service");
const ioredis_1 = require("ioredis");
let RedisHealthIndicator = RedisHealthIndicator_1 = class RedisHealthIndicator {
    constructor(healthIndicatorService, environmentService) {
        this.healthIndicatorService = healthIndicatorService;
        this.environmentService = environmentService;
        this.logger = new common_1.Logger(RedisHealthIndicator_1.name);
    }
    async pingCheck(key) {
        const indicator = this.healthIndicatorService.check(key);
        try {
            const redis = new ioredis_1.Redis(this.environmentService.getRedisUrl(), {
                maxRetriesPerRequest: 15,
            });
            await redis.ping();
            redis.disconnect();
            return indicator.up();
        }
        catch (e) {
            this.logger.error(e);
            return indicator.down(`${key} is not available`);
        }
    }
};
exports.RedisHealthIndicator = RedisHealthIndicator;
exports.RedisHealthIndicator = RedisHealthIndicator = RedisHealthIndicator_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [terminus_1.HealthIndicatorService,
        environment_service_1.EnvironmentService])
], RedisHealthIndicator);
//# sourceMappingURL=redis.health.js.map