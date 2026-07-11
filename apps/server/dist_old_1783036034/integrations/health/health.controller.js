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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const terminus_1 = require("@nestjs/terminus");
const postgres_health_1 = require("./postgres.health");
const redis_health_1 = require("./redis.health");
const skip_transform_decorator_1 = require("../../common/decorators/skip-transform.decorator");
let HealthController = class HealthController {
    constructor(health, postgres, redis) {
        this.health = health;
        this.postgres = postgres;
        this.redis = redis;
    }
    async check() {
        return this.health.check([
            () => this.postgres.pingCheck('database'),
            () => this.redis.pingCheck('redis'),
        ]);
    }
    async checkLive() {
        return 'ok';
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, skip_transform_decorator_1.SkipTransform)(),
    (0, common_1.Get)(),
    (0, terminus_1.HealthCheck)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "checkLive", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [terminus_1.HealthCheckService,
        postgres_health_1.PostgresHealthIndicator,
        redis_health_1.RedisHealthIndicator])
], HealthController);
//# sourceMappingURL=health.controller.js.map