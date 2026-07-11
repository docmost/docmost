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
exports.WatcherController = void 0;
const common_1 = require("@nestjs/common");
const watcher_service_1 = require("./watcher.service");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const watcher_dto_1 = require("./dto/watcher.dto");
const page_repo_1 = require("../../database/repos/page/page.repo");
const page_access_service_1 = require("../page/page-access/page-access.service");
let WatcherController = class WatcherController {
    constructor(watcherService, pageRepo, pageAccessService) {
        this.watcherService = watcherService;
        this.pageRepo = pageRepo;
        this.pageAccessService = pageAccessService;
    }
    async watchPage(dto, user, workspace) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        await this.watcherService.watchPage(user.id, page.id, page.spaceId, workspace.id);
        return { watching: true };
    }
    async unwatchPage(dto, user) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        await this.watcherService.unwatchPage(user.id, page.id, page.spaceId, page.workspaceId);
        return { watching: false };
    }
    async getWatchStatus(dto, user) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        const watching = await this.watcherService.isWatchingPage(user.id, page.id);
        return { watching };
    }
};
exports.WatcherController = WatcherController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('watch'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [watcher_dto_1.WatcherPageDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WatcherController.prototype, "watchPage", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('unwatch'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [watcher_dto_1.WatcherPageDto, Object]),
    __metadata("design:returntype", Promise)
], WatcherController.prototype, "unwatchPage", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('watch-status'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [watcher_dto_1.WatcherPageDto, Object]),
    __metadata("design:returntype", Promise)
], WatcherController.prototype, "getWatchStatus", null);
exports.WatcherController = WatcherController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('pages'),
    __metadata("design:paramtypes", [watcher_service_1.WatcherService,
        page_repo_1.PageRepo,
        page_access_service_1.PageAccessService])
], WatcherController);
//# sourceMappingURL=watcher.controller.js.map