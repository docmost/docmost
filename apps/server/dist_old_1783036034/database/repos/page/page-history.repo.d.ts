import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { InsertablePageHistory, Page, PageHistory } from "../../types/entity.types";
import { PaginationOptions } from "../../pagination/pagination-options";
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
export declare class PageHistoryRepo {
    private readonly db;
    constructor(db: KyselyDB);
    private baseFields;
    findById(pageHistoryId: string, opts?: {
        includeContent?: boolean;
        trx?: KyselyTransaction;
    }): Promise<PageHistory>;
    insertPageHistory(insertablePageHistory: InsertablePageHistory, trx?: KyselyTransaction): Promise<PageHistory>;
    saveHistory(page: Page, opts?: {
        contributorIds?: string[];
        trx?: KyselyTransaction;
    }): Promise<void>;
    findPageHistoryByPageId(pageId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        workspaceId: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        content: import("@docmost/db/types/db").JsonValue;
        slug: string;
        spaceId: string;
        contributorIds: string[];
        coverPhoto: string;
        icon: string;
        lastUpdatedById: string;
        slugId: string;
        pageId: string;
        version: number;
    } & {
        lastUpdatedBy: {
            id: string;
            name: string;
            avatarUrl: string;
        };
    } & {
        contributors: {
            id: string;
            name: string;
            avatarUrl: string;
        }[];
    }, undefined>>;
    findPageLastHistory(pageId: string, opts?: {
        includeContent?: boolean;
        trx?: KyselyTransaction;
    }): Promise<{
        id: string;
        workspaceId: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        content: import("@docmost/db/types/db").JsonValue;
        slug: string;
        spaceId: string;
        contributorIds: string[];
        coverPhoto: string;
        icon: string;
        lastUpdatedById: string;
        slugId: string;
        pageId: string;
        version: number;
    }>;
    withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pageHistory'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }, "lastUpdatedBy">;
    withContributors(eb: ExpressionBuilder<DB, 'pageHistory'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }[], "contributors">;
}
