import { FavoriteService } from './services/favorite.service';
import { AddFavoriteDto, RemoveFavoriteDto } from './dto/favorite.dto';
import { FavoriteIdsDto } from './dto/favorite-ids.dto';
import { ListFavoritesDto } from './dto/list-favorites.dto';
import { PaginationOptions } from "../../database/pagination/pagination-options";
import { User, Workspace } from "../../database/types/entity.types";
import { PageRepo } from "../../database/repos/page/page.repo";
import { SpaceRepo } from "../../database/repos/space/space.repo";
import { SpaceMemberRepo } from "../../database/repos/space/space-member.repo";
import { PageAccessService } from '../page/page-access/page-access.service';
import { TemplateRepo } from "../../database/repos/template/template.repo";
export declare class FavoriteController {
    private readonly favoriteService;
    private readonly pageRepo;
    private readonly spaceRepo;
    private readonly spaceMemberRepo;
    private readonly pageAccessService;
    private readonly templateRepo;
    constructor(favoriteService: FavoriteService, pageRepo: PageRepo, spaceRepo: SpaceRepo, spaceMemberRepo: SpaceMemberRepo, pageAccessService: PageAccessService, templateRepo: TemplateRepo);
    addFavorite(dto: AddFavoriteDto, user: User, workspace: Workspace): Promise<void>;
    removeFavorite(dto: RemoveFavoriteDto, user: User, workspace: Workspace): Promise<void>;
    getFavoriteIds(dto: FavoriteIdsDto, user: User, workspace: Workspace): Promise<{
        items: string[];
        meta: any;
    }>;
    getUserFavorites(dto: ListFavoritesDto, pagination: PaginationOptions, user: User, workspace: Workspace): Promise<import("../../database/pagination/cursor-pagination").CursorPaginationResult<{
        type: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        userId: string;
        spaceId: string;
        pageId: string;
        templateId: string;
    }, undefined>>;
    private resolveAndValidate;
    private validateSpaceAccess;
}
