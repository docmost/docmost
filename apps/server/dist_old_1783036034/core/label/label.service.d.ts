import { Label } from "../../database/types/entity.types";
import { LabelRepo, LabelType } from "../../database/repos/label/label.repo";
import { KyselyDB } from "../../database/types/kysely.types";
import { PaginationOptions } from "../../database/pagination/pagination-options";
import { PagePermissionRepo } from "../../database/repos/page/page-permission.repo";
export declare class LabelService {
    private readonly labelRepo;
    private readonly pagePermissionRepo;
    private readonly db;
    constructor(labelRepo: LabelRepo, pagePermissionRepo: PagePermissionRepo, db: KyselyDB);
    addLabelsToPage(pageId: string, names: string[], workspaceId: string): Promise<Label[]>;
    removeLabelFromPage(pageId: string, labelId: string, workspaceId: string): Promise<void>;
    getPageLabels(pageId: string, pagination: PaginationOptions): Promise<{
        items: {
            type: string;
            id: string;
            workspaceId: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
        }[];
        meta: {
            limit: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
            nextCursor: string | null;
            prevCursor: string | null;
        };
    }>;
    getLabels(workspaceId: string, userId: string, type: LabelType, pagination: PaginationOptions): Promise<import("../../database/pagination/cursor-pagination").CursorPaginationResult<{
        type: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
    }, undefined>>;
    findPagesByLabel(labelId: string, userId: string, opts: {
        spaceId?: string;
        query?: string;
        pagination: PaginationOptions;
    }): Promise<import("../../database/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        spaceId: string;
        icon: string;
        slugId: string;
        space: {
            id: string;
            logo: string;
            name: string;
            slug: string;
        };
        creator: {
            id: string;
            name: string;
            avatarUrl: string;
        };
        labels: {
            id: string;
            name: string;
        }[];
    }, undefined>>;
    getLabelInfo(name: string, type: LabelType, workspaceId: string, userId: string, spaceId?: string): Promise<{
        name: string;
        usageCount: number;
    }>;
}
