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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupGuard = void 0;
const common_1 = require("@nestjs/common");
const workspace_repo_1 = require("../../../database/repos/workspace/workspace.repo");
const environment_service_1 = require("../../../integrations/environment/environment.service");
let SetupGuard = class SetupGuard {
    constructor(workspaceRepo, environmentService) {
        this.workspaceRepo = workspaceRepo;
        this.environmentService = environmentService;
    }
    async canActivate() {
        if (this.environmentService.isCloud()) {
            return false;
        }
        const workspaceCount = await this.workspaceRepo.count();
        if (workspaceCount > 0) {
            throw new common_1.ForbiddenException('Workspace setup already completed.');
        }
        return true;
    }
};
exports.SetupGuard = SetupGuard;
exports.SetupGuard = SetupGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [workspace_repo_1.WorkspaceRepo,
        environment_service_1.EnvironmentService])
], SetupGuard);
//# sourceMappingURL=setup.guard.js.map