import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { InsertableFavorite, Favorite } from "../../types/entity.types";
import { PaginationOptions } from "../../pagination/pagination-options";
export declare const FavoriteType: {
    readonly PAGE: "page";
    readonly SPACE: "space";
    readonly TEMPLATE: "template";
};
export type FavoriteType = (typeof FavoriteType)[keyof typeof FavoriteType];
export declare class FavoriteRepo {
    private readonly db;
    constructor(db: KyselyDB);
    insert(favorite: InsertableFavorite): Promise<Favorite | undefined>;
    deleteByUserAndPage(userId: string, pageId: string): Promise<void>;
    deleteByUserAndSpace(userId: string, spaceId: string): Promise<void>;
    deleteByUserAndTemplate(userId: string, templateId: string): Promise<void>;
    getFavoriteIds(userId: string, workspaceId: string, type: FavoriteType, spaceId?: string): Promise<{
        items: string[];
        meta: any;
    }>;
    findUserFavorites(userId: string, workspaceId: string, pagination: PaginationOptions, type?: FavoriteType, spaceId?: string): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        type: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        userId: string;
        spaceId: string;
        pageId: string;
        templateId: string;
    }, undefined>>;
    deleteByUsersWithoutSpaceAccess(userIds: string[], spaceId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
    deleteByUserAndWorkspace(userId: string, workspaceId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
    private applySpaceFilter;
    private withPage;
    private withSpace;
    private withPageSpace;
    private withSpaceResolved;
    private withTemplate;
}
