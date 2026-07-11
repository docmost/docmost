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
exports.GroupController = void 0;
const common_1 = require("@nestjs/common");
const group_service_1 = require("./services/group.service");
const create_group_dto_1 = require("./dto/create-group.dto");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const group_user_service_1 = require("./services/group-user.service");
const group_id_dto_1 = require("./dto/group-id.dto");
const pagination_options_1 = require("../../database/pagination/pagination-options");
const add_group_user_dto_1 = require("./dto/add-group-user.dto");
const remove_group_user_dto_1 = require("./dto/remove-group-user.dto");
const update_group_dto_1 = require("./dto/update-group.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const workspace_ability_factory_1 = require("../casl/abilities/workspace-ability.factory");
const workspace_ability_type_1 = require("../casl/interfaces/workspace-ability.type");
let GroupController = class GroupController {
    constructor(groupService, groupUserService, workspaceAbility) {
        this.groupService = groupService;
        this.groupUserService = groupUserService;
        this.workspaceAbility = workspaceAbility;
    }
    getWorkspaceGroups(pagination, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Read, workspace_ability_type_1.WorkspaceCaslSubject.Group)) {
            throw new common_1.ForbiddenException();
        }
        return this.groupService.getWorkspaceGroups(workspace.id, pagination);
    }
    getGroup(groupIdDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Read, workspace_ability_type_1.WorkspaceCaslSubject.Group)) {
            throw new common_1.ForbiddenException();
        }
        return this.groupService.getGroupInfo(groupIdDto.groupId, workspace.id);
    }
    createGroup(createGroupDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Group)) {
            throw new common_1.ForbiddenException();
        }
        return this.groupService.createGroup(user, workspace.id, createGroupDto);
    }
    updateGroup(updateGroupDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Group)) {
            throw new common_1.ForbiddenException();
        }
        return this.groupService.updateGroup(workspace.id, updateGroupDto);
    }
    getGroupMembers(groupIdDto, pagination, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Read, workspace_ability_type_1.WorkspaceCaslSubject.Group)) {
            throw new common_1.ForbiddenException();
        }
        return this.groupUserService.getGroupUsers(groupIdDto.groupId, workspace.id, pagination);
    }
    addGroupMember(addGroupUserDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Group)) {
            throw new common_1.ForbiddenException();
        }
        return this.groupUserService.addUsersToGroupBatch(addGroupUserDto.userIds, addGroupUserDto.groupId, workspace.id);
    }
    removeGroupMember(removeGroupUserDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Group)) {
            throw new common_1.ForbiddenException();
        }
        return this.groupUserService.removeUserFromGroup(removeGroupUserDto.userId, removeGroupUserDto.groupId, workspace.id);
    }
    deleteGroup(groupIdDto, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Group)) {
            throw new common_1.ForbiddenException();
        }
        return this.groupService.deleteGroup(groupIdDto.groupId, workspace.id);
    }
};
exports.GroupController = GroupController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_options_1.PaginationOptions, Object, Object]),
    __metadata("design:returntype", void 0)
], GroupController.prototype, "getWorkspaceGroups", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/info'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [group_id_dto_1.GroupIdDto, Object, Object]),
    __metadata("design:returntype", void 0)
], GroupController.prototype, "getGroup", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_group_dto_1.CreateGroupDto, Object, Object]),
    __metadata("design:returntype", void 0)
], GroupController.prototype, "createGroup", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_group_dto_1.UpdateGroupDto, Object, Object]),
    __metadata("design:returntype", void 0)
], GroupController.prototype, "updateGroup", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __param(3, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [group_id_dto_1.GroupIdDto,
        pagination_options_1.PaginationOptions, Object, Object]),
    __metadata("design:returntype", void 0)
], GroupController.prototype, "getGroupMembers", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members/add'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [add_group_user_dto_1.AddGroupUserDto, Object, Object]),
    __metadata("design:returntype", void 0)
], GroupController.prototype, "addGroupMember", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('members/remove'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [remove_group_user_dto_1.RemoveGroupUserDto, Object, Object]),
    __metadata("design:returntype", void 0)
], GroupController.prototype, "removeGroupMember", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [group_id_dto_1.GroupIdDto, Object, Object]),
    __metadata("design:returntype", void 0)
], GroupController.prototype, "deleteGroup", null);
exports.GroupController = GroupController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('groups'),
    __metadata("design:paramtypes", [group_service_1.GroupService,
        group_user_service_1.GroupUserService,
        workspace_ability_factory_1.default])
], GroupController);
//# sourceMappingURL=group.controller.js.map