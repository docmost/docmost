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
exports.SpaceWatcherController = void 0;
const common_1 = require("@nestjs/common");
const watcher_service_1 = require("./watcher.service");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const space_watcher_dto_1 = require("./dto/space-watcher.dto");
const space_repo_1 = require("../../database/repos/space/space.repo");
const space_ability_factory_1 = require("../casl/abilities/space-ability.factory");
const space_ability_type_1 = require("../casl/interfaces/space-ability.type");
let SpaceWatcherController = class SpaceWatcherController {
    constructor(watcherService, spaceRepo, spaceAbility) {
        this.watcherService = watcherService;
        this.spaceRepo = spaceRepo;
        this.spaceAbility = spaceAbility;
    }
    async loadSpaceAndAuthorize(spaceId, user, workspace) {
        const space = await this.spaceRepo.findById(spaceId, workspace.id);
        if (!space) {
            throw new common_1.NotFoundException('Space not found');
        }
        const ability = await this.spaceAbility.createForUser(user, space.id);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Settings)) {
            throw new common_1.ForbiddenException();
        }
        return space;
    }
    async getWatchedSpaceIds(user, workspace) {
        return this.watcherService.getWatchedSpaceIds(user.id, workspace.id);
    }
    async watchSpace(dto, user, workspace) {
        const space = await this.loadSpaceAndAuthorize(dto.spaceId, user, workspace);
        await this.watcherService.watchSpace(user.id, space.id, workspace.id);
        return { watching: true };
    }
    async unwatchSpace(dto, user, workspace) {
        const space = await this.loadSpaceAndAuthorize(dto.spaceId, user, workspace);
        await this.watcherService.unwatchSpace(user.id, space.id);
        return { watching: false };
    }
    async getWatchStatus(dto, user, workspace) {
        const space = await this.loadSpaceAndAuthorize(dto.spaceId, user, workspace);
        const watching = await this.watcherService.isWatchingSpace(user.id, space.id);
        return { watching };
    }
};
exports.SpaceWatcherController = SpaceWatcherController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('watched-ids'),
    __param(0, (0, auth_user_decorator_1.AuthUser)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceWatcherController.prototype, "getWatchedSpaceIds", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('watch'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [space_watcher_dto_1.SpaceWatcherDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceWatcherController.prototype, "watchSpace", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('unwatch'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [space_watcher_dto_1.SpaceWatcherDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceWatcherController.prototype, "unwatchSpace", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('watch-status'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [space_watcher_dto_1.SpaceWatcherDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SpaceWatcherController.prototype, "getWatchStatus", null);
exports.SpaceWatcherController = SpaceWatcherController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('spaces'),
    __metadata("design:paramtypes", [watcher_service_1.WatcherService,
        space_repo_1.SpaceRepo,
        space_ability_factory_1.default])
], SpaceWatcherController);
//# sourceMappingURL=space-watcher.controller.js.map