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
exports.UserService = void 0;
const user_repo_1 = require("../../database/repos/user/user.repo");
const common_1 = require("@nestjs/common");
const utils_1 = require("../../common/helpers/utils");
const auth_util_1 = require("../auth/auth.util");
const audit_events_1 = require("../../common/events/audit-events");
const audit_service_1 = require("../../integrations/audit/audit.service");
let UserService = class UserService {
    constructor(userRepo, auditService) {
        this.userRepo = userRepo;
        this.auditService = auditService;
    }
    async findById(userId, workspaceId) {
        return this.userRepo.findById(userId, workspaceId);
    }
    async update(updateUserDto, userId, workspace) {
        const includePassword = updateUserDto.email != null && updateUserDto.confirmPassword != null;
        const user = await this.userRepo.findById(userId, workspace.id, {
            includePassword,
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (typeof updateUserDto.fullPageWidth !== 'undefined') {
            return this.userRepo.updatePreference(userId, 'fullPageWidth', updateUserDto.fullPageWidth);
        }
        if (typeof updateUserDto.pageEditMode !== 'undefined') {
            return this.userRepo.updatePreference(userId, 'pageEditMode', updateUserDto.pageEditMode.toLowerCase());
        }
        if (typeof updateUserDto.editorToolbar !== 'undefined') {
            return this.userRepo.updatePreference(userId, 'editorToolbar', updateUserDto.editorToolbar);
        }
        const notificationSettings = {
            notificationPageUpdates: 'page.updated',
            notificationPageUserMention: 'page.userMention',
            notificationCommentUserMention: 'comment.userMention',
            notificationCommentCreated: 'comment.created',
            notificationCommentResolved: 'comment.resolved',
        };
        for (const [dtoField, settingKey] of Object.entries(notificationSettings)) {
            if (typeof updateUserDto[dtoField] !== 'undefined') {
                return this.userRepo.updateNotificationSetting(userId, settingKey, updateUserDto[dtoField]);
            }
        }
        const userBefore = { name: user.name, email: user.email, locale: user.locale };
        if (updateUserDto.name) {
            user.name = updateUserDto.name;
        }
        if (updateUserDto.email && user.email != updateUserDto.email) {
            (0, auth_util_1.validateSsoEnforcement)(workspace);
            if (!updateUserDto.confirmPassword) {
                throw new common_1.BadRequestException('You must provide a password to change your email');
            }
            const isPasswordMatch = await (0, utils_1.comparePasswordHash)(updateUserDto.confirmPassword, user.password);
            if (!isPasswordMatch) {
                throw new common_1.BadRequestException('You must provide the correct password to change your email');
            }
            if (await this.userRepo.findByEmail(updateUserDto.email, workspace.id)) {
                throw new common_1.BadRequestException('A user with this email already exists');
            }
            user.email = updateUserDto.email;
        }
        if (updateUserDto.locale) {
            user.locale = updateUserDto.locale;
        }
        delete updateUserDto.confirmPassword;
        await this.userRepo.updateUser(updateUserDto, userId, workspace.id);
        const changes = (0, utils_1.diffAuditTrackedFields)(['name', 'email'], updateUserDto, userBefore, user);
        if (changes) {
            this.auditService.log({
                event: audit_events_1.AuditEvent.USER_UPDATED,
                resourceType: audit_events_1.AuditResource.USER,
                resourceId: userId,
                changes,
            });
        }
        return user;
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [user_repo_1.UserRepo, Object])
], UserService);
//# sourceMappingURL=user.service.js.map