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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionController = void 0;
const common_1 = require("@nestjs/common");
const session_service_1 = require("./session.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const revoke_session_dto_1 = require("./dto/revoke-session.dto");
let SessionController = class SessionController {
    constructor(sessionService) {
        this.sessionService = sessionService;
    }
    async listSessions(user, workspace, req) {
        const currentSessionId = req.raw.sessionId ?? null;
        const sessions = await this.sessionService.getActiveSessions(user.id, workspace.id, currentSessionId);
        return { sessions };
    }
    async revokeSession(dto, user, workspace, req) {
        const currentSessionId = req.raw.sessionId;
        if (dto.sessionId === currentSessionId) {
            throw new common_1.BadRequestException('Cannot revoke current session. Use logout instead.');
        }
        await this.sessionService.revokeSession(dto.sessionId, user.id, workspace.id);
    }
    async revokeAllSessions(user, workspace, req) {
        const currentSessionId = req.raw.sessionId;
        if (!currentSessionId) {
            throw new common_1.BadRequestException('Current session not found. Please log in again.');
        }
        await this.sessionService.revokeAllOtherSessions(currentSessionId, user.id, workspace.id);
    }
};
exports.SessionController = SessionController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, auth_user_decorator_1.AuthUser)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "listSessions", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('revoke'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [revoke_session_dto_1.RevokeSessionDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "revokeSession", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('revoke-all'),
    __param(0, (0, auth_user_decorator_1.AuthUser)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "revokeAllSessions", null);
exports.SessionController = SessionController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('sessions'),
    __metadata("design:paramtypes", [session_service_1.SessionService])
], SessionController);
//# sourceMappingURL=session.controller.js.map