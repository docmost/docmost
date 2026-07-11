import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { Label } from "../../types/entity.types";
import { SpaceMemberRepo } from "../space/space-member.repo";
import { PaginationOptions } from "../../pagination/pagination-options";
export declare const LabelType: {
    readonly PAGE: "page";
    readonly SPACE: "space";
};
export type LabelType = (typeof LabelType)[keyof typeof LabelType];
export declare class LabelRepo {
    private readonly db;
    private readonly spaceMemberRepo;
    constructor(db: KyselyDB, spaceMemberRepo: SpaceMemberRepo);
    findById(labelId: string, trx?: KyselyTransaction): Promise<Label | undefined>;
    findByNameAndWorkspace(name: string, workspaceId: string, type: LabelType, trx?: KyselyTransaction): Promise<Label | undefined>;
    findOrCreate(name: string, workspaceId: string, type: LabelType, trx?: KyselyTransaction): Promise<Label>;
    findLabelsByPageId(pageId: string, pagination: PaginationOptions): Promise<{
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
    findLabels(workspaceId: string, userId: string, type: LabelType, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        type: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
    }, undefined>>;
    addLabelToPage(pageId: string, labelId: string, trx?: KyselyTransaction): Promise<void>;
    removeLabelFromPage(pageId: string, labelId: string, workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    getPageLabelCount(pageId: string, trx?: KyselyTransaction): Promise<number>;
    getLabelPageCount(labelId: string, workspaceId: string, trx?: KyselyTransaction): Promise<number>;
    deleteLabel(labelId: string, workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    findPagesByLabelId(labelId: string, userId: string, opts: {
        spaceId?: string;
        query?: string;
        pagination: PaginationOptions;
    }): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
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
    getLabelPageCountForUser(labelId: string, userId: string, spaceId?: string): Promise<number>;
}
