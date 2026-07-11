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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const token_service_1 = require("./token.service");
const session_service_1 = require("../../session/session.service");
const user_session_repo_1 = require("../../../database/repos/session/user-session.repo");
const signup_service_1 = require("./signup.service");
const user_repo_1 = require("../../../database/repos/user/user.repo");
const helpers_1 = require("../../../common/helpers");
const auth_util_1 = require("../auth.util");
const mail_service_1 = require("../../../integrations/mail/mail.service");
const change_password_email_1 = require("../../../integrations/transactional/emails/change-password-email");
const forgot_password_email_1 = require("../../../integrations/transactional/emails/forgot-password-email");
const user_token_repo_1 = require("../../../database/repos/user-token/user-token.repo");
const auth_constants_1 = require("../auth.constants");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../../database/utils");
const domain_service_1 = require("../../../integrations/environment/domain.service");
const audit_events_1 = require("../../../common/events/audit-events");
const audit_service_1 = require("../../../integrations/audit/audit.service");
const environment_service_1 = require("../../../integrations/environment/environment.service");
let AuthService = class AuthService {
    constructor(signupService, tokenService, sessionService, userSessionRepo, userRepo, userTokenRepo, mailService, domainService, environmentService, db, auditService) {
        this.signupService = signupService;
        this.tokenService = tokenService;
        this.sessionService = sessionService;
        this.userSessionRepo = userSessionRepo;
        this.userRepo = userRepo;
        this.userTokenRepo = userTokenRepo;
        this.mailService = mailService;
        this.domainService = domainService;
        this.environmentService = environmentService;
        this.db = db;
        this.auditService = auditService;
    }
    async login(loginDto, workspaceId) {
        const user = await this.userRepo.findByEmail(loginDto.email, workspaceId, {
            includePassword: true,
        });
        const errorMessage = 'Email or password does not match';
        if (!user || (0, helpers_1.isUserDisabled)(user)) {
            throw new common_1.UnauthorizedException(errorMessage);
        }
        const isPasswordMatch = await (0, helpers_1.comparePasswordHash)(loginDto.password, user.password);
        if (!isPasswordMatch) {
            throw new common_1.UnauthorizedException(errorMessage);
        }
        (0, auth_util_1.throwIfEmailNotVerified)({
            isCloud: this.environmentService.isCloud(),
            emailVerifiedAt: user.emailVerifiedAt,
            email: user.email,
            workspaceId,
            appSecret: this.environmentService.getAppSecret(),
        });
        user.lastLoginAt = new Date();
        await this.userRepo.updateLastLogin(user.id, workspaceId);
        this.auditService.log({
            event: audit_events_1.AuditEvent.USER_LOGIN,
            resourceType: audit_events_1.AuditResource.USER,
            resourceId: user.id,
            metadata: { source: 'password' },
        });
        return this.sessionService.createSessionAndToken(user);
    }
    async register(createUserDto, workspaceId) {
        const user = await this.signupService.signup(createUserDto, workspaceId);
        return this.sessionService.createSessionAndToken(user);
    }
    async setup(createAdminUserDto) {
        const { workspace, user } = await this.signupService.initialSetup(createAdminUserDto);
        const authToken = await this.sessionService.createSessionAndToken(user);
        return { workspace, authToken };
    }
    async changePassword(dto, userId, workspaceId, currentSessionId) {
        const user = await this.userRepo.findById(userId, workspaceId, {
            includePassword: true,
        });
        if (!user || (0, helpers_1.isUserDisabled)(user)) {
            throw new common_1.NotFoundException('User not found');
        }
        const comparePasswords = await (0, helpers_1.comparePasswordHash)(dto.oldPassword, user.password);
        if (!comparePasswords) {
            throw new common_1.BadRequestException('Current password is incorrect');
        }
        const newPasswordHash = await (0, helpers_1.hashPassword)(dto.newPassword);
        await this.userRepo.updateUser({
            password: newPasswordHash,
            hasGeneratedPassword: false,
        }, userId, workspaceId);
        if (currentSessionId) {
            await this.userSessionRepo.deleteAllExceptCurrent(currentSessionId, userId, workspaceId);
        }
        else {
            await this.userSessionRepo.deleteByUserId(userId, workspaceId);
        }
        this.auditService.log({
            event: audit_events_1.AuditEvent.USER_PASSWORD_CHANGED,
            resourceType: audit_events_1.AuditResource.USER,
            resourceId: userId,
        });
        const emailTemplate = (0, change_password_email_1.default)({ username: user.name });
        await this.mailService.sendToQueue({
            to: user.email,
            subject: 'Your password has been changed',
            template: emailTemplate,
        });
    }
    async forgotPassword(forgotPasswordDto, workspace) {
        const user = await this.userRepo.findByEmail(forgotPasswordDto.email, workspace.id);
        if (!user || (0, helpers_1.isUserDisabled)(user)) {
            return;
        }
        const token = (0, helpers_1.nanoIdGen)(16);
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            await trx
                .deleteFrom('userTokens')
                .where('userId', '=', user.id)
                .where('type', '=', auth_constants_1.UserTokenType.FORGOT_PASSWORD)
                .execute();
            await this.userTokenRepo.insertUserToken({
                token,
                userId: user.id,
                workspaceId: user.workspaceId,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000),
                type: auth_constants_1.UserTokenType.FORGOT_PASSWORD,
            }, { trx });
        });
        const resetLink = `${this.domainService.getUrl(workspace.hostname)}/password-reset?token=${token}`;
        const emailTemplate = (0, forgot_password_email_1.default)({
            username: user.name,
            resetLink: resetLink,
        });
        await this.mailService.sendToQueue({
            to: user.email,
            subject: 'Reset your password',
            template: emailTemplate,
        });
    }
    async passwordReset(passwordResetDto, workspace) {
        const userToken = await this.userTokenRepo.findById(passwordResetDto.token, workspace.id);
        if (!userToken ||
            userToken.type !== auth_constants_1.UserTokenType.FORGOT_PASSWORD ||
            userToken.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Invalid or expired token');
        }
        const user = await this.userRepo.findById(userToken.userId, workspace.id, {
            includeUserMfa: true,
        });
        if (!user || (0, helpers_1.isUserDisabled)(user)) {
            throw new common_1.NotFoundException('User not found');
        }
        const newPasswordHash = await (0, helpers_1.hashPassword)(passwordResetDto.newPassword);
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            await this.userRepo.updateUser({
                password: newPasswordHash,
                hasGeneratedPassword: false,
            }, user.id, workspace.id, trx);
            await trx
                .deleteFrom('userTokens')
                .where('userId', '=', user.id)
                .where('type', '=', auth_constants_1.UserTokenType.FORGOT_PASSWORD)
                .execute();
        });
        await this.userSessionRepo.deleteByUserId(user.id, workspace.id);
        this.auditService.setActorId(user.id);
        this.auditService.log({
            event: audit_events_1.AuditEvent.USER_PASSWORD_RESET,
            resourceType: audit_events_1.AuditResource.USER,
            resourceId: user.id,
        });
        const emailTemplate = (0, change_password_email_1.default)({ username: user.name });
        await this.mailService.sendToQueue({
            to: user.email,
            subject: 'Your password has been changed',
            template: emailTemplate,
        });
        if (this.environmentService.isCloud() && !user.emailVerifiedAt) {
            await this.userRepo.updateUser({ emailVerifiedAt: new Date() }, user.id, workspace.id);
        }
        const userHasMfa = user?.['mfa']?.isEnabled || false;
        const workspaceEnforcesMfa = workspace.enforceMfa || false;
        if (userHasMfa || workspaceEnforcesMfa) {
            return {
                requiresLogin: true,
            };
        }
        const authToken = await this.sessionService.createSessionAndToken(user);
        return { authToken };
    }
    async verifyUserToken(userTokenDto, workspaceId) {
        const userToken = await this.userTokenRepo.findById(userTokenDto.token, workspaceId);
        if (!userToken ||
            userToken.type !== userTokenDto.type ||
            userToken.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Invalid or expired token');
        }
    }
    async getCollabToken(user, workspaceId) {
        const token = await this.tokenService.generateCollabToken(user, workspaceId);
        return { token };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(9, (0, nestjs_kysely_1.InjectKysely)()),
    __param(10, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [signup_service_1.SignupService,
        token_service_1.TokenService,
        session_service_1.SessionService,
        user_session_repo_1.UserSessionRepo,
        user_repo_1.UserRepo,
        user_token_repo_1.UserTokenRepo,
        mail_service_1.MailService,
        domain_service_1.DomainService,
        environment_service_1.EnvironmentService, Object, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map