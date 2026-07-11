"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const ability_1 = require("@casl/ability");
const permission_1 = require("../../../common/helpers/types/permission");
const workspace_ability_type_1 = require("../interfaces/workspace-ability.type");
let WorkspaceAbilityFactory = class WorkspaceAbilityFactory {
    createForUser(user, workspace) {
        const userRole = user.role;
        switch (userRole) {
            case permission_1.UserRole.OWNER:
                return buildWorkspaceOwnerAbility();
            case permission_1.UserRole.ADMIN:
                return buildWorkspaceAdminAbility();
            case permission_1.UserRole.MEMBER:
                return buildWorkspaceMemberAbility();
            default:
                throw new common_1.NotFoundException('Workspace permissions not found');
        }
    }
};
WorkspaceAbilityFactory = __decorate([
    (0, common_1.Injectable)()
], WorkspaceAbilityFactory);
exports.default = WorkspaceAbilityFactory;
function buildWorkspaceOwnerAbility() {
    const { can, build } = new ability_1.AbilityBuilder(ability_1.createMongoAbility);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Settings);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Space);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Group);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Attachment);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.API);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Audit);
    return build();
}
function buildWorkspaceAdminAbility() {
    const { can, build } = new ability_1.AbilityBuilder(ability_1.createMongoAbility);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Settings);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Space);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Group);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Member);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Attachment);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.API);
    return build();
}
function buildWorkspaceMemberAbility() {
    const { can, build } = new ability_1.AbilityBuilder(ability_1.createMongoAbility);
    can(workspace_ability_type_1.WorkspaceCaslAction.Read, workspace_ability_type_1.WorkspaceCaslSubject.Settings);
    can(workspace_ability_type_1.WorkspaceCaslAction.Read, workspace_ability_type_1.WorkspaceCaslSubject.Member);
    can(workspace_ability_type_1.WorkspaceCaslAction.Read, workspace_ability_type_1.WorkspaceCaslSubject.Space);
    can(workspace_ability_type_1.WorkspaceCaslAction.Read, workspace_ability_type_1.WorkspaceCaslSubject.Group);
    can(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Attachment);
    can(workspace_ability_type_1.WorkspaceCaslAction.Create, workspace_ability_type_1.WorkspaceCaslSubject.API);
    return build();
}
//# sourceMappingURL=workspace-ability.factory.js.map