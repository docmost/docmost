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
exports.SessionActivityService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_ioredis_1 = require("@nestjs-labs/nestjs-ioredis");
const user_session_repo_1 = require("../../database/repos/session/user-session.repo");
const user_repo_1 = require("../../database/repos/user/user.repo");
const THROTTLE_SECONDS = 15 * 60;
let SessionActivityService = class SessionActivityService {
    constructor(redisService, userSessionRepo, userRepo) {
        this.redisService = redisService;
        this.userSessionRepo = userSessionRepo;
        this.userRepo = userRepo;
        this.redis = this.redisService.getOrThrow();
    }
    trackActivity(sessionId, userId, workspaceId) {
        const key = `session:activity:${sessionId}`;
        this.redis
            .set(key, '1', 'EX', THROTTLE_SECONDS, 'NX')
            .then((result) => {
            if (result === null)
                return;
            this.userSessionRepo.updateLastActiveAt(sessionId).catch(() => { });
            this.userRepo
                .updateUser({ lastActiveAt: new Date() }, userId, workspaceId)
                .catch(() => { });
        })
            .catch(() => { });
    }
};
exports.SessionActivityService = SessionActivityService;
exports.SessionActivityService = SessionActivityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nestjs_ioredis_1.RedisService,
        user_session_repo_1.UserSessionRepo,
        user_repo_1.UserRepo])
], SessionActivityService);
//# sourceMappingURL=session-activity.service.js.map