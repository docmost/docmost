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
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const user_service_1 = require("./user.service");
const update_user_dto_1 = require("./dto/update-user.dto");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const workspace_repo_1 = require("../../database/repos/workspace/workspace.repo");
let UserController = class UserController {
    constructor(userService, workspaceRepo) {
        this.userService = userService;
        this.workspaceRepo = workspaceRepo;
    }
    async getUserInfo(authUser, workspace) {
        const memberCount = await this.workspaceRepo.getActiveUserCount(workspace.id);
        const { licenseKey, ...rest } = workspace;
        const workspaceInfo = {
            ...rest,
            memberCount,
        };
        return { user: authUser, workspace: workspaceInfo };
    }
    async updateUser(updateUserDto, user, workspace) {
        return this.userService.update(updateUserDto, user.id, workspace);
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('me'),
    __param(0, (0, auth_user_decorator_1.AuthUser)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getUserInfo", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_user_dto_1.UpdateUserDto, Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateUser", null);
exports.UserController = UserController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [user_service_1.UserService,
        workspace_repo_1.WorkspaceRepo])
], UserController);
//# sourceMappingURL=user.controller.js.map