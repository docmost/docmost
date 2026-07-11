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
exports.PageUpdateEmailRateLimiter = void 0;
const common_1 = require("@nestjs/common");
const nestjs_ioredis_1 = require("@nestjs-labs/nestjs-ioredis");
const KEY_PREFIX = 'page-update:emails:';
const DIGEST_PREFIX = 'page-update:digest:';
const TTL_SECONDS = 86400;
const MAX_IMMEDIATE_EMAILS = 4;
let PageUpdateEmailRateLimiter = class PageUpdateEmailRateLimiter {
    constructor(redisService) {
        this.redisService = redisService;
        this.redis = this.redisService.getOrThrow();
    }
    async canSendEmail(userId) {
        const key = KEY_PREFIX + userId;
        const count = await this.redis.incr(key);
        await this.redis.expire(key, TTL_SECONDS, 'NX');
        return count <= MAX_IMMEDIATE_EMAILS;
    }
    async addToDigest(userId, notificationId) {
        const key = DIGEST_PREFIX + userId;
        const len = await this.redis.rpush(key, notificationId);
        await this.redis.expire(key, TTL_SECONDS);
        return len === 1;
    }
    async popDigest(userId) {
        const key = DIGEST_PREFIX + userId;
        const [ids] = await this.redis
            .multi()
            .lrange(key, 0, -1)
            .del(key)
            .exec();
        return ids?.[1] ?? [];
    }
};
exports.PageUpdateEmailRateLimiter = PageUpdateEmailRateLimiter;
exports.PageUpdateEmailRateLimiter = PageUpdateEmailRateLimiter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nestjs_ioredis_1.RedisService])
], PageUpdateEmailRateLimiter);
//# sourceMappingURL=page-update-email-rate-limiter.js.map