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
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const throttler_names_1 = require("../../integrations/throttle/throttler-names");
const login_dto_1 = require("./dto/login.dto");
const auth_service_1 = require("./services/auth.service");
const session_service_1 = require("../session/session.service");
const setup_guard_1 = require("./guards/setup.guard");
const environment_service_1 = require("../../integrations/environment/environment.service");
const create_admin_user_dto_1 = require("./dto/create-admin-user.dto");
const change_password_dto_1 = require("./dto/change-password.dto");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const forgot_password_dto_1 = require("./dto/forgot-password.dto");
const password_reset_dto_1 = require("./dto/password-reset.dto");
const verify_user_token_dto_1 = require("./dto/verify-user-token.dto");
const auth_util_1 = require("./auth.util");
const core_1 = require("@nestjs/core");
const audit_events_1 = require("../../common/events/audit-events");
const audit_service_1 = require("../../integrations/audit/audit.service");
let AuthController = AuthController_1 = class AuthController {
    constructor(authService, sessionService, environmentService, moduleRef, auditService) {
        this.authService = authService;
        this.sessionService = sessionService;
        this.environmentService = environmentService;
        this.moduleRef = moduleRef;
        this.auditService = auditService;
        this.logger = new common_1.Logger(AuthController_1.name);
    }
    async login(workspace, res, loginInput) {
        (0, auth_util_1.validateSsoEnforcement)(workspace);
        let MfaModule;
        let isMfaModuleReady = false;
        try {
            MfaModule = require('./../../ee/mfa/services/mfa.service');
            isMfaModuleReady = true;
        }
        catch (err) {
            this.logger.debug('MFA module requested but EE module not bundled in this build');
            isMfaModuleReady = false;
        }
        if (isMfaModuleReady) {
            const mfaService = this.moduleRef.get(MfaModule.MfaService, {
                strict: false,
            });
            const mfaResult = await mfaService.checkMfaRequirements(loginInput, workspace, res);
            if (mfaResult) {
                if (mfaResult.userHasMfa || mfaResult.requiresMfaSetup) {
                    return {
                        userHasMfa: mfaResult.userHasMfa,
                        requiresMfaSetup: mfaResult.requiresMfaSetup,
                        isMfaEnforced: mfaResult.isMfaEnforced,
                    };
                }
                else if (mfaResult.authToken) {
                    this.setAuthCookie(res, mfaResult.authToken);
                    return;
                }
            }
        }
        const authToken = await this.authService.login(loginInput, workspace.id);
        this.setAuthCookie(res, authToken);
    }
    async setupWorkspace(res, createAdminUserDto) {
        const { workspace, authToken } = await this.authService.setup(createAdminUserDto);
        this.setAuthCookie(res, authToken);
        return workspace;
    }
    async changePassword(dto, user, workspace, req) {
        const currentSessionId = req.raw.sessionId;
        return this.authService.changePassword(dto, user.id, workspace.id, currentSessionId);
    }
    async forgotPassword(forgotPasswordDto, workspace) {
        (0, auth_util_1.validateSsoEnforcement)(workspace);
        return this.authService.forgotPassword(forgotPasswordDto, workspace);
    }
    async passwordReset(res, passwordResetDto, workspace) {
        const result = await this.authService.passwordReset(passwordResetDto, workspace);
        if (result.requiresLogin) {
            return {
                requiresLogin: true,
            };
        }
        this.setAuthCookie(res, result.authToken);
        return {
            requiresLogin: false,
        };
    }
    async verifyResetToken(verifyUserTokenDto, workspace) {
        return this.authService.verifyUserToken(verifyUserTokenDto, workspace.id);
    }
    async collabToken(user, workspace) {
        return this.authService.getCollabToken(user, workspace.id);
    }
    async logout(user, req, res) {
        const sessionId = req.raw.sessionId;
        if (sessionId) {
            await this.sessionService.revokeSession(sessionId, user.id, user.workspaceId);
        }
        res.clearCookie('authToken');
        this.auditService.log({
            event: audit_events_1.AuditEvent.USER_LOGOUT,
            resourceType: audit_events_1.AuditResource.USER,
            resourceId: user.id,
        });
    }
    setAuthCookie(res, token) {
        res.setCookie('authToken', token, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            expires: this.environmentService.getCookieExpiresIn(),
            secure: this.environmentService.isHttps(),
        });
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('login'),
    __param(0, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, login_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.UseGuards)(setup_guard_1.SetupGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('setup'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_admin_user_dto_1.CreateAdminUserDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "setupWorkspace", null);
__decorate([
    (0, throttler_1.SkipThrottle)({ [throttler_names_1.AUTH_THROTTLER]: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('change-password'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [change_password_dto_1.ChangePasswordDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('forgot-password'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forgot_password_dto_1.ForgotPasswordDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('password-reset'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, password_reset_dto_1.PasswordResetDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "passwordReset", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('verify-token'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_user_token_dto_1.VerifyUserTokenDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyResetToken", null);
__decorate([
    (0, throttler_1.SkipThrottle)({ [throttler_names_1.AUTH_THROTTLER]: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('collab-token'),
    __param(0, (0, auth_user_decorator_1.AuthUser)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "collabToken", null);
__decorate([
    (0, throttler_1.SkipThrottle)({ [throttler_names_1.AUTH_THROTTLER]: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('logout'),
    __param(0, (0, auth_user_decorator_1.AuthUser)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, throttler_1.SkipThrottle)({ [throttler_names_1.AI_CHAT_THROTTLER]: true }),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, common_1.Controller)('auth'),
    __param(4, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        session_service_1.SessionService,
        environment_service_1.EnvironmentService,
        core_1.ModuleRef, Object])
], AuthController);
//# sourceMappingURL=auth.controller.js.map