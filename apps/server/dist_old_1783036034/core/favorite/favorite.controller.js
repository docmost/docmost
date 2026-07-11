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
exports.FavoriteController = void 0;
const common_1 = require("@nestjs/common");
const favorite_service_1 = require("./services/favorite.service");
const favorite_dto_1 = require("./dto/favorite.dto");
const favorite_ids_dto_1 = require("./dto/favorite-ids.dto");
const list_favorites_dto_1 = require("./dto/list-favorites.dto");
const pagination_options_1 = require("../../database/pagination/pagination-options");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const page_repo_1 = require("../../database/repos/page/page.repo");
const space_repo_1 = require("../../database/repos/space/space.repo");
const space_member_repo_1 = require("../../database/repos/space/space-member.repo");
const page_access_service_1 = require("../page/page-access/page-access.service");
const template_repo_1 = require("../../database/repos/template/template.repo");
let FavoriteController = class FavoriteController {
    constructor(favoriteService, pageRepo, spaceRepo, spaceMemberRepo, pageAccessService, templateRepo) {
        this.favoriteService = favoriteService;
        this.pageRepo = pageRepo;
        this.spaceRepo = spaceRepo;
        this.spaceMemberRepo = spaceMemberRepo;
        this.pageAccessService = pageAccessService;
        this.templateRepo = templateRepo;
    }
    async addFavorite(dto, user, workspace) {
        const resolved = await this.resolveAndValidate(dto, user, workspace.id);
        await this.favoriteService.addFavorite(user.id, workspace.id, {
            type: dto.type,
            pageId: dto.pageId,
            spaceId: dto.type === 'space' ? resolved.spaceId : undefined,
            templateId: dto.templateId,
        });
    }
    async removeFavorite(dto, user, workspace) {
        await this.resolveAndValidate(dto, user, workspace.id);
        await this.favoriteService.removeFavorite(user.id, {
            type: dto.type,
            pageId: dto.pageId,
            spaceId: dto.spaceId,
            templateId: dto.templateId,
        });
    }
    async getFavoriteIds(dto, user, workspace) {
        return this.favoriteService.getFavoriteIds(user.id, workspace.id, dto.type, dto.spaceId);
    }
    async getUserFavorites(dto, pagination, user, workspace) {
        return this.favoriteService.getUserFavorites(user.id, workspace.id, pagination, dto.type, dto.spaceId);
    }
    async resolveAndValidate(dto, user, workspaceId) {
        if (dto.type === 'page') {
            if (!dto.pageId)
                throw new common_1.BadRequestException('pageId is required');
            const page = await this.pageRepo.findById(dto.pageId);
            if (!page)
                throw new common_1.NotFoundException('Page not found');
            await this.pageAccessService.validateCanView(page, user);
            return { spaceId: page.spaceId, page };
        }
        if (dto.type === 'space') {
            if (!dto.spaceId)
                throw new common_1.BadRequestException('spaceId is required');
            const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
            if (!space)
                throw new common_1.NotFoundException('Space not found');
            await this.validateSpaceAccess(user.id, space.id);
            return { spaceId: space.id };
        }
        if (dto.type === 'template') {
            if (!dto.templateId)
                throw new common_1.BadRequestException('templateId is required');
            const template = await this.templateRepo.findById(dto.templateId, workspaceId);
            if (!template)
                throw new common_1.NotFoundException('Template not found');
            if (template.spaceId) {
                await this.validateSpaceAccess(user.id, template.spaceId);
            }
            return { spaceId: template.spaceId };
        }
        throw new common_1.BadRequestException('Invalid favorite type');
    }
    async validateSpaceAccess(userId, spaceId) {
        const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
        if (!userSpaceIds.includes(spaceId)) {
            throw new common_1.ForbiddenException();
        }
    }
};
exports.FavoriteController = FavoriteController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('add'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [favorite_dto_1.AddFavoriteDto, Object, Object]),
    __metadata("design:returntype", Promise)
], FavoriteController.prototype, "addFavorite", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('remove'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [favorite_dto_1.RemoveFavoriteDto, Object, Object]),
    __metadata("design:returntype", Promise)
], FavoriteController.prototype, "removeFavorite", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('ids'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [favorite_ids_dto_1.FavoriteIdsDto, Object, Object]),
    __metadata("design:returntype", Promise)
], FavoriteController.prototype, "getFavoriteIds", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __param(3, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_favorites_dto_1.ListFavoritesDto,
        pagination_options_1.PaginationOptions, Object, Object]),
    __metadata("design:returntype", Promise)
], FavoriteController.prototype, "getUserFavorites", null);
exports.FavoriteController = FavoriteController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('favorites'),
    __metadata("design:paramtypes", [favorite_service_1.FavoriteService,
        page_repo_1.PageRepo,
        space_repo_1.SpaceRepo,
        space_member_repo_1.SpaceMemberRepo,
        page_access_service_1.PageAccessService,
        template_repo_1.TemplateRepo])
], FavoriteController);
//# sourceMappingURL=favorite.controller.js.map