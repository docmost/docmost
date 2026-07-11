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
exports.WorkspaceController = void 0;
const common_1 = require("@nestjs/common");
const workspace_service_1 = require("../services/workspace.service");
const update_workspace_dto_1 = require("../dto/update-workspace.dto");
const update_workspace_user_role_dto_1 = require("../dto/update-workspace-user-role.dto");
const auth_user_decorator_1 = require("../../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../../common/decorators/auth-workspace.decorator");
const pagination_options_1 = require("../../../database/pagination/pagination-options");
const workspace_invitation_service_1 = require("../services/workspace-invitation.service");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const invitation_dto_1 = require("../dto/invitation.dto");
const jwt_auth_guard_1 = require("../../../common/guards/jwt-auth.guard");
const workspace_ability_factory_1 = require("../../casl/abilities/workspace-ability.factory");
const workspace_ability_type_1 = require("../../casl/interfaces/workspace-ability.type");
const environment_service_1 = require("../../../integrations/environment/environment.service");
const license_check_service_1 = require("../../../integrations/environment/license-check.service");
const check_hostname_dto_1 = require("../dto/check-hostname.dto");
const remove_workspace_user_dto_1 = require("../dto/remove-workspace-user.dto");
const workspace_repo_1 = require("../../../database/repos/workspace/workspace.repo");
let WorkspaceController = class WorkspaceController {
    constructor(workspaceService, workspaceInvitationService, workspaceAbility, workspaceRepo, environmentService, licenseCheckService) {
        this.workspaceService = workspaceService;
        this.workspaceInvitationService = workspaceInvitationService;
        this.workspaceAbility = workspaceAbility;
        this.workspaceRepo = workspaceRepo;
        this.environmentService = environmentService;
        this.licenseCheckService = licenseCheckService;
    }
    async getWorkspacePublicInfo(req) {
        return this.workspaceService.getWorkspacePublicData(req.raw.workspaceId);
    }
    async getWorkspace(workspace) {
        return this.workspaceService.getWorkspaceInfo(workspace.id);
    }
    async getEntitlements(workspace) {
        let { licenseKey } = workspace;
        const { plan } = workspace;
        if (!licenseKey) {
            licenseKey = await this.workspaceRepo.findLicenseKeyById(workspace.id);
        }
        return {
            cloud: this.environmentService.isCloud(),
            tier: this.licenseCheckService.resolveTier(licenseKey, plan),
            features: this.licenseCheckService.resolveFeatures(licenseKey, plan),
        };
    }
    async updateWorkspace(res, dto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Settings)) {
            throw new common_1.ForbiddenException();
        }
        const updatedWorkspace = await this.workspaceService.update(workspace.id, dto);
        if (dto.hostname &&
            dto.hostname === updatedWorkspace.hostname &&
            workspace.hostname !== updatedWorkspace.hostname) {
            res.clearCookie('authToken');
        }
        return updatedWorkspace;
    }
    async getWorkspaceMembers(pagination, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Read, workspace_ability_type_1.WorkspaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        return this.workspaceService.getWorkspaceUsers(workspace.id, pagination);
    }
    async deactivateWorkspaceMember(dto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        await this.workspaceService.deactivateUser(user, dto.userId, workspace.id);
    }
    async activateWorkspaceMember(dto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        await this.workspaceService.activateUser(user, dto.userId, workspace.id);
    }
    async deleteWorkspaceMember(dto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        await this.workspaceService.deleteUser(user, dto.userId, workspace.id);
    }
    async updateWorkspaceMemberRole(workspaceUserRoleDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        return this.workspaceService.updateWorkspaceUserRole(user, workspaceUserRoleDto, workspace.id);
    }
    async getInvitations(user, workspace, pagination) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Read, workspace_ability_type_1.WorkspaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        return this.workspaceInvitationService.getInvitations(workspace.id, pagination);
    }
    async getInvitationById(dto, workspace) {
        return this.workspaceInvitationService.getInvitationById(dto.invitationId, workspace);
    }
    async inviteUser(inviteUserDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        return this.workspaceInvitationService.createInvitation(inviteUserDto, workspace, user);
    }
    async resendInvite(revokeInviteDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        return this.workspaceInvitationService.resendInvitation(revokeInviteDto.invitationId, workspace);
    }
    async revokeInvite(revokeInviteDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        return this.workspaceInvitationService.revokeInvitation(revokeInviteDto.invitationId, workspace.id);
    }
    async acceptInvite(acceptInviteDto, workspace, res) {
        const result = await this.workspaceInvitationService.acceptInvitation(acceptInviteDto, workspace);
        if (result.requiresLogin) {
            return {
                requiresLogin: true,
            };
        }
        res.setCookie('authToken', result.authToken, {
            httpOnly: true,
            path: '/',
            expires: this.environmentService.getCookieExpiresIn(),
            secure: this.environmentService.isHttps(),
        });
        return {
            requiresLogin: false,
        };
    }
    async checkHostname(checkHostnameDto) {
        return this.workspaceService.checkHostname(checkHostnameDto.hostname);
    }
    async getInviteLink(inviteDto, user, workspace) {
        if (this.environmentService.isCloud()) {
            throw new common_1.ForbiddenException();
        }
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        const inviteLink = await this.workspaceInvitationService.getInvitationLinkById(inviteDto.invitationId, workspace);
        return { inviteLink };
    }
};
exports.WorkspaceController = WorkspaceController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/public'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "getWorkspacePublicInfo", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/info'),
    __param(0, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "getWorkspace", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('entitlements'),
    __param(0, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "getEntitlements", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('update'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __param(3, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_workspace_dto_1.UpdateWorkspaceDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "updateWorkspace", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_options_1.PaginationOptions, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "getWorkspaceMembers", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members/deactivate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [remove_workspace_user_dto_1.RemoveWorkspaceUserDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "deactivateWorkspaceMember", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members/activate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [remove_workspace_user_dto_1.RemoveWorkspaceUserDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "activateWorkspaceMember", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [remove_workspace_user_dto_1.RemoveWorkspaceUserDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "deleteWorkspaceMember", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members/change-role'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_workspace_user_role_dto_1.UpdateWorkspaceUserRoleDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "updateWorkspaceMemberRole", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('invites'),
    __param(0, (0, auth_user_decorator_1.AuthUser)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, pagination_options_1.PaginationOptions]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "getInvitations", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('invites/info'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [invitation_dto_1.InvitationIdDto, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "getInvitationById", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('invites/create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [invitation_dto_1.InviteUserDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "inviteUser", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('invites/resend'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [invitation_dto_1.RevokeInviteDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "resendInvite", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('invites/revoke'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [invitation_dto_1.RevokeInviteDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "revokeInvite", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('invites/accept'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [invitation_dto_1.AcceptInviteDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "acceptInvite", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/check-hostname'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [check_hostname_dto_1.CheckHostnameDto]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "checkHostname", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('invites/link'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [invitation_dto_1.InvitationIdDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspaceController.prototype, "getInviteLink", null);
exports.WorkspaceController = WorkspaceController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('workspace'),
    __metadata("design:paramtypes", [workspace_service_1.WorkspaceService,
        workspace_invitation_service_1.WorkspaceInvitationService,
        workspace_ability_factory_1.default,
        workspace_repo_1.WorkspaceRepo,
        environment_service_1.EnvironmentService,
        license_check_service_1.LicenseCheckService])
], WorkspaceController);
//# sourceMappingURL=workspace.controller.js.map