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
var SessionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const token_service_1 = require("../auth/services/token.service");
const user_session_repo_1 = require("../../database/repos/session/user-session.repo");
const environment_service_1 = require("../../integrations/environment/environment.service");
const nestjs_cls_1 = require("nestjs-cls");
const audit_context_middleware_1 = require("../../common/middlewares/audit-context.middleware");
const Bowser = require("bowser");
const MAX_SESSIONS_PER_USER = 25;
const RETENTION_DAYS = 7;
let SessionService = SessionService_1 = class SessionService {
    constructor(tokenService, userSessionRepo, environmentService, cls) {
        this.tokenService = tokenService;
        this.userSessionRepo = userSessionRepo;
        this.environmentService = environmentService;
        this.cls = cls;
        this.logger = new common_1.Logger(SessionService_1.name);
    }
    async cleanupSessions() {
        try {
            await this.userSessionRepo.deleteStale(RETENTION_DAYS);
            await this.userSessionRepo.trimExcessSessions(MAX_SESSIONS_PER_USER);
            this.logger.debug('Session cleanup completed');
        }
        catch (err) {
            this.logger.error('Session cleanup failed', err);
        }
    }
    async createSessionAndToken(user) {
        const auditContext = this.cls.get(audit_context_middleware_1.AUDIT_CONTEXT_KEY);
        const ipAddress = auditContext?.ipAddress ?? null;
        const userAgent = auditContext?.userAgent ?? null;
        const deviceName = this.parseDeviceName(userAgent);
        const expiresAt = this.environmentService.getCookieExpiresIn();
        const session = await this.userSessionRepo.insertSession({
            userId: user.id,
            workspaceId: user.workspaceId,
            deviceName,
            ipAddress,
            expiresAt,
        });
        return this.tokenService.generateAccessToken(user, session.id);
    }
    async getActiveSessions(userId, workspaceId, currentSessionId) {
        const sessions = await this.userSessionRepo.findActiveByUser(userId, workspaceId);
        const mapped = sessions.map((s) => ({
            id: s.id,
            deviceName: s.deviceName,
            geoLocation: s.geoLocation,
            lastActiveAt: s.lastActiveAt,
            createdAt: s.createdAt,
            isCurrentDevice: s.id === currentSessionId,
        }));
        return mapped.sort((a, b) => {
            if (a.isCurrentDevice)
                return -1;
            if (b.isCurrentDevice)
                return 1;
            return 0;
        });
    }
    async revokeSession(sessionId, userId, workspaceId) {
        await this.userSessionRepo.revokeById(sessionId, userId, workspaceId);
    }
    async revokeAllOtherSessions(currentSessionId, userId, workspaceId) {
        await this.userSessionRepo.revokeAllExceptCurrent(currentSessionId, userId, workspaceId);
    }
    parseDeviceName(userAgent) {
        if (!userAgent)
            return null;
        try {
            const parsed = Bowser.parse(userAgent);
            const os = parsed.os?.name;
            const browser = parsed.browser?.name;
            const platformType = parsed.platform?.type;
            if (platformType === 'mobile' || platformType === 'tablet') {
                return parsed.platform?.model || os || 'Mobile Device';
            }
            if (os) {
                return browser ? `${browser} on ${os}` : os;
            }
            return browser || null;
        }
        catch {
            return null;
        }
    }
};
exports.SessionService = SessionService;
__decorate([
    (0, schedule_1.Interval)('session-cleanup', 24 * 60 * 60 * 1000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SessionService.prototype, "cleanupSessions", null);
exports.SessionService = SessionService = SessionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [token_service_1.TokenService,
        user_session_repo_1.UserSessionRepo,
        environment_service_1.EnvironmentService,
        nestjs_cls_1.ClsService])
], SessionService);
//# sourceMappingURL=session.service.js.map