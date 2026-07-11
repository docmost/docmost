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
exports.DomainMiddleware = void 0;
const common_1 = require("@nestjs/common");
const environment_service_1 = require("../../integrations/environment/environment.service");
const workspace_repo_1 = require("../../database/repos/workspace/workspace.repo");
let DomainMiddleware = class DomainMiddleware {
    constructor(workspaceRepo, environmentService) {
        this.workspaceRepo = workspaceRepo;
        this.environmentService = environmentService;
    }
    async use(req, res, next) {
        if (this.environmentService.isSelfHosted()) {
            const workspace = await this.workspaceRepo.findFirst();
            if (!workspace) {
                req.workspaceId = null;
                return next();
            }
            req.workspaceId = workspace.id;
            req.workspace = workspace;
        }
        else if (this.environmentService.isCloud()) {
            const header = req.headers.host;
            const subdomain = header.split('.')[0];
            const workspace = await this.workspaceRepo.findByHostname(subdomain);
            if (!workspace) {
                req.workspaceId = null;
                return next();
            }
            req.workspaceId = workspace.id;
            req.workspace = workspace;
        }
        next();
    }
};
exports.DomainMiddleware = DomainMiddleware;
exports.DomainMiddleware = DomainMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [workspace_repo_1.WorkspaceRepo,
        environment_service_1.EnvironmentService])
], DomainMiddleware);
//# sourceMappingURL=domain.middleware.js.map