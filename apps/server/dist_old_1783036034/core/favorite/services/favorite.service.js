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
exports.FavoriteService = void 0;
const common_1 = require("@nestjs/common");
const favorite_repo_1 = require("../../../database/repos/favorite/favorite.repo");
const page_permission_repo_1 = require("../../../database/repos/page/page-permission.repo");
const space_member_repo_1 = require("../../../database/repos/space/space-member.repo");
let FavoriteService = class FavoriteService {
    constructor(favoriteRepo, pagePermissionRepo, spaceMemberRepo) {
        this.favoriteRepo = favoriteRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.spaceMemberRepo = spaceMemberRepo;
    }
    async getFavoriteIds(userId, workspaceId, type, spaceId) {
        const result = await this.favoriteRepo.getFavoriteIds(userId, workspaceId, type, spaceId);
        if (result.items.length === 0) {
            return result;
        }
        if (type === favorite_repo_1.FavoriteType.PAGE) {
            const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                pageIds: result.items,
                userId,
            });
            const accessibleSet = new Set(accessibleIds);
            result.items = result.items.filter((id) => accessibleSet.has(id));
        }
        if (type === favorite_repo_1.FavoriteType.SPACE) {
            const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
            const spaceSet = new Set(userSpaceIds);
            result.items = result.items.filter((id) => spaceSet.has(id));
        }
        return result;
    }
    async addFavorite(userId, workspaceId, opts) {
        const favorite = {
            userId,
            pageId: opts.pageId ?? null,
            spaceId: opts.spaceId ?? null,
            templateId: opts.templateId ?? null,
            type: opts.type,
            workspaceId,
        };
        await this.favoriteRepo.insert(favorite);
    }
    async removeFavorite(userId, opts) {
        if (opts.type === favorite_repo_1.FavoriteType.PAGE && opts.pageId) {
            await this.favoriteRepo.deleteByUserAndPage(userId, opts.pageId);
        }
        else if (opts.type === favorite_repo_1.FavoriteType.SPACE && opts.spaceId) {
            await this.favoriteRepo.deleteByUserAndSpace(userId, opts.spaceId);
        }
        else if (opts.type === favorite_repo_1.FavoriteType.TEMPLATE && opts.templateId) {
            await this.favoriteRepo.deleteByUserAndTemplate(userId, opts.templateId);
        }
    }
    async getUserFavorites(userId, workspaceId, pagination, type, spaceId) {
        const result = await this.favoriteRepo.findUserFavorites(userId, workspaceId, pagination, type, spaceId);
        if (result.items.length === 0) {
            return result;
        }
        const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
        const spaceSet = new Set(userSpaceIds);
        const pageFavorites = result.items.filter((f) => f.type === favorite_repo_1.FavoriteType.PAGE && f.pageId);
        let accessiblePageSet;
        if (pageFavorites.length > 0) {
            const pageIds = pageFavorites.map((f) => f.pageId);
            const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                pageIds,
                userId,
            });
            accessiblePageSet = new Set(accessibleIds);
        }
        result.items = result.items.filter((f) => {
            if (f.type === favorite_repo_1.FavoriteType.PAGE) {
                return f.pageId && accessiblePageSet?.has(f.pageId);
            }
            if (f.type === favorite_repo_1.FavoriteType.SPACE) {
                return f.spaceId && spaceSet.has(f.spaceId);
            }
            if (f.type === favorite_repo_1.FavoriteType.TEMPLATE) {
                const templateSpaceId = f.template?.spaceId;
                return !templateSpaceId || spaceSet.has(templateSpaceId);
            }
            return true;
        });
        return result;
    }
};
exports.FavoriteService = FavoriteService;
exports.FavoriteService = FavoriteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [favorite_repo_1.FavoriteRepo,
        page_permission_repo_1.PagePermissionRepo,
        space_member_repo_1.SpaceMemberRepo])
], FavoriteService);
//# sourceMappingURL=favorite.service.js.map