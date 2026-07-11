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
exports.CollabHistoryService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_ioredis_1 = require("@nestjs-labs/nestjs-ioredis");
const REDIS_KEY_PREFIX = 'history:contributors:';
let CollabHistoryService = class CollabHistoryService {
    constructor(redisService) {
        this.redisService = redisService;
        this.redis = this.redisService.getOrThrow();
    }
    async addContributors(pageId, userIds) {
        if (userIds.length === 0)
            return;
        await this.redis.sadd(REDIS_KEY_PREFIX + pageId, ...userIds);
    }
    async popContributors(pageId) {
        const key = REDIS_KEY_PREFIX + pageId;
        const count = await this.redis.scard(key);
        if (count === 0)
            return [];
        return await this.redis.spop(key, count);
    }
    async clearContributors(pageId) {
        await this.redis.del(REDIS_KEY_PREFIX + pageId);
    }
};
exports.CollabHistoryService = CollabHistoryService;
exports.CollabHistoryService = CollabHistoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nestjs_ioredis_1.RedisService])
], CollabHistoryService);
//# sourceMappingURL=collab-history.service.js.map