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
exports.SpaceController = void 0;
const common_1 = require("@nestjs/common");
const space_service_1 = require("./services/space.service");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const space_id_dto_1 = require("./dto/space-id.dto");
const pagination_options_1 = require("../../database/pagination/pagination-options");
const space_member_service_1 = require("./services/space-member.service");
const add_space_members_dto_1 = require("./dto/add-space-members.dto");
const remove_space_member_dto_1 = require("./dto/remove-space-member.dto");
const update_space_member_role_dto_1 = require("./dto/update-space-member-role.dto");
const space_ability_factory_1 = require("../casl/abilities/space-ability.factory");
const space_ability_type_1 = require("../casl/interfaces/space-ability.type");
const update_space_dto_1 = require("./dto/update-space.dto");
const utils_1 = require("../../database/repos/space/utils");
const space_member_repo_1 = require("../../database/repos/space/space-member.repo");
const workspace_ability_type_1 = require("../casl/interfaces/workspace-ability.type");
const workspace_ability_factory_1 = require("../casl/abilities/workspace-ability.factory");
const create_space_dto_1 = require("./dto/create-space.dto");
let SpaceController = class SpaceController {
    constructor(spaceService, spaceMemberService, spaceMemberRepo, spaceAbility, workspaceAbility) {
        this.spaceService = spaceService;
        this.spaceMemberService = spaceMemberService;
        this.spaceMemberRepo = spaceMemberRepo;
        this.spaceAbility = spaceAbility;
        this.workspaceAbility = workspaceAbility;
    }
    async getWorkspaceSpaces(pagination, user) {
        const result = await this.spaceMemberService.getUserSpaces(user.id, pagination);
        if (result.items.length > 0) {
            const spaceIds = result.items.map((s) => s.id);
            const roles = await this.spaceMemberRepo.getUserRolesForSpaces(user.id, spaceIds);
            const roleMap = new Map();
            for (const row of roles) {
                const existing = roleMap.get(row.spaceId) || [];
                existing.push(row.role);
                roleMap.set(row.spaceId, existing);
            }
            result.items = result.items.map((space) => {
                const spaceRoles = roleMap.get(space.id);
                const role = spaceRoles
                    ? (0, utils_1.findHighestUserSpaceRole)(spaceRoles.map((r) => ({ userId: user.id, role: r })))
                    : undefined;
                return {
                    ...space,
                    membership: { userId: user.id, role },
                };
            });
        }
        return result;
    }
    async getSpaceInfo(spaceIdDto, user, workspace) {
        const space = await this.spaceService.getSpaceInfo(spaceIdDto.spaceId, workspace.id);
        if (!space) {
            throw new common_1.NotFoundException('Space not found');
        }
        const ability = await this.spaceAbility.createForUser(user, space.id);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Settings)) {
            throw new common_1.ForbiddenException();
        }
        const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(user.id, space.id);
        const userSpaceRole = (0, utils_1.findHighestUserSpaceRole)(userSpaceRoles);
        const membership = {
            userId: user.id,
            role: userSpaceRole,
            permissions: ability.rules,
        };
        return { ...space, membership };
    }
    createSpace(createSpaceDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Space)) {
            throw new common_1.ForbiddenException();
        }
        return this.spaceService.createSpace(user, workspace.id, createSpaceDto);
    }
    async updateSpace(updateSpaceDto, user, workspace) {
        const ability = await this.spaceAbility.createForUser(user, updateSpaceDto.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Settings)) {
            throw new common_1.ForbiddenException();
        }
        return this.spaceService.updateSpace(updateSpaceDto, workspace.id);
    }
    async deleteSpace(spaceIdDto, user, workspace) {
        const ability = await this.spaceAbility.createForUser(user, spaceIdDto.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Settings)) {
            throw new common_1.ForbiddenException();
        }
        return this.spaceService.deleteSpace(spaceIdDto.spaceId, workspace.id);
    }
    async getSpaceMembers(spaceIdDto, pagination, user, workspace) {
        const ability = await this.spaceAbility.createForUser(user, spaceIdDto.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        return this.spaceMemberService.getSpaceMembers(spaceIdDto.spaceId, workspace.id, pagination);
    }
    async addSpaceMember(dto, user, workspace) {
        if ((!dto.userIds || dto.userIds.length === 0) &&
            (!dto.groupIds || dto.groupIds.length === 0)) {
            throw new common_1.BadRequestException('userIds or groupIds is required');
        }
        const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        return this.spaceMemberService.addMembersToSpaceBatch(dto, user, workspace.id);
    }
    async removeSpaceMember(dto, user, workspace) {
        this.validateIds(dto);
        const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        return this.spaceMemberService.removeMemberFromSpace(dto, workspace.id);
    }
    async updateSpaceMemberRole(dto, user, workspace) {
        this.validateIds(dto);
        const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Member)) {
            throw new common_1.ForbiddenException();
        }
        return this.spaceMemberService.updateSpaceMemberRole(dto, workspace.id);
    }
    validateIds(dto) {
        if (!dto.userId && !dto.groupId) {
            throw new common_1.BadRequestException('userId or groupId is required');
        }
        if (dto.userId && dto.groupId) {
            throw new common_1.BadRequestException('please provide either a userId or groupId and both');
        }
    }
};
exports.SpaceController = SpaceController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_options_1.PaginationOptions, Object]),
    __metadata("design:returntype", Promise)
], SpaceController.prototype, "getWorkspaceSpaces", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('info'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [space_id_dto_1.SpaceIdDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceController.prototype, "getSpaceInfo", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_space_dto_1.CreateSpaceDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SpaceController.prototype, "createSpace", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_space_dto_1.UpdateSpaceDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceController.prototype, "updateSpace", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [space_id_dto_1.SpaceIdDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceController.prototype, "deleteSpace", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __param(3, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [space_id_dto_1.SpaceIdDto,
        pagination_options_1.PaginationOptions, Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceController.prototype, "getSpaceMembers", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members/add'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [add_space_members_dto_1.AddSpaceMembersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceController.prototype, "addSpaceMember", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members/remove'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [remove_space_member_dto_1.RemoveSpaceMemberDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceController.prototype, "removeSpaceMember", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members/change-role'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_space_member_role_dto_1.UpdateSpaceMemberRoleDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceController.prototype, "updateSpaceMemberRole", null);
exports.SpaceController = SpaceController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('spaces'),
    __metadata("design:paramtypes", [space_service_1.SpaceService,
        space_member_service_1.SpaceMemberService,
        space_member_repo_1.SpaceMemberRepo,
        space_ability_factory_1.default,
        workspace_ability_factory_1.default])
], SpaceController);
//# sourceMappingURL=space.controller.js.map