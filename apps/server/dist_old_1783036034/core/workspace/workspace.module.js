"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceModule = void 0;
const common_1 = require("@nestjs/common");
const workspace_service_1 = require("./services/workspace.service");
const workspace_controller_1 = require("./controllers/workspace.controller");
const space_module_1 = require("../space/space.module");
const workspace_invitation_service_1 = require("./services/workspace-invitation.service");
const token_module_1 = require("../auth/token.module");
let WorkspaceModule = class WorkspaceModule {
};
exports.WorkspaceModule = WorkspaceModule;
exports.WorkspaceModule = WorkspaceModule = __decorate([
    (0, common_1.Module)({
        imports: [space_module_1.SpaceModule, token_module_1.TokenModule],
        controllers: [workspace_controller_1.WorkspaceController],
        providers: [workspace_service_1.WorkspaceService, workspace_invitation_service_1.WorkspaceInvitationService],
        exports: [workspace_service_1.WorkspaceService],
    })
], WorkspaceModule);
//# sourceMappingURL=workspace.module.js.map