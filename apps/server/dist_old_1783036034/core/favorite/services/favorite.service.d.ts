import { FavoriteRepo, FavoriteType } from "../../../database/repos/favorite/favorite.repo";
import { PaginationOptions } from "../../../database/pagination/pagination-options";
import { PagePermissionRepo } from "../../../database/repos/page/page-permission.repo";
import { SpaceMemberRepo } from "../../../database/repos/space/space-member.repo";
export declare class FavoriteService {
    private readonly favoriteRepo;
    private readonly pagePermissionRepo;
    private readonly spaceMemberRepo;
    constructor(favoriteRepo: FavoriteRepo, pagePermissionRepo: PagePermissionRepo, spaceMemberRepo: SpaceMemberRepo);
    getFavoriteIds(userId: string, workspaceId: string, type: FavoriteType, spaceId?: string): Promise<{
        items: string[];
        meta: any;
    }>;
    addFavorite(userId: string, workspaceId: string, opts: {
        type: FavoriteType;
        pageId?: string;
        spaceId?: string;
        templateId?: string;
    }): Promise<void>;
    removeFavorite(userId: string, opts: {
        type: FavoriteType;
        pageId?: string;
        spaceId?: string;
        templateId?: string;
    }): Promise<void>;
    getUserFavorites(userId: string, workspaceId: string, pagination: PaginationOptions, type?: FavoriteType, spaceId?: string): Promise<import("../../../database/pagination/cursor-pagination").CursorPaginationResult<{
        type: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        userId: string;
        spaceId: string;
        pageId: string;
        templateId: string;
    }, undefined>>;
}
