import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { InsertableShare, Share, UpdatableShare } from "../../types/entity.types";
import { PaginationOptions } from "../../pagination/pagination-options";
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { SpaceMemberRepo } from "../space/space-member.repo";
export declare class ShareRepo {
    private readonly db;
    private spaceMemberRepo;
    constructor(db: KyselyDB, spaceMemberRepo: SpaceMemberRepo);
    private baseFields;
    findById(shareId: string, opts?: {
        includeSharedPage?: boolean;
        includeCreator?: boolean;
        withLock?: boolean;
        trx?: KyselyTransaction;
    }): Promise<Share>;
    findByPageId(pageId: string, opts?: {
        includeCreator?: boolean;
        withLock?: boolean;
        trx?: KyselyTransaction;
    }): Promise<Share>;
    updateShare(updatableShare: UpdatableShare, shareId: string, trx?: KyselyTransaction): Promise<{
        key: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        spaceId: string;
        pageId: string;
        includeSubPages: boolean;
        searchIndexing: boolean;
    }>;
    insertShare(insertableShare: InsertableShare, trx?: KyselyTransaction): Promise<Share>;
    deleteShare(shareId: string): Promise<void>;
    deleteBySpaceId(spaceId: string, trx?: KyselyTransaction): Promise<void>;
    deleteByWorkspaceId(workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    getShares(userId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        key: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        spaceId: string;
        pageId: string;
        includeSubPages: boolean;
        searchIndexing: boolean;
    } & {
        page: {
            id: string;
            title: string;
            icon: string;
            slugId: string;
        };
    } & {
        space: {
            id: string;
            name: string;
            slug: string;
            userRole?: string;
        };
    } & {
        creator: {
            id: string;
            name: string;
            avatarUrl: string;
        };
    }, undefined>>;
    withPage(eb: ExpressionBuilder<DB, 'shares'>): import("kysely").AliasedRawBuilder<{
        id: string;
        title: string;
        icon: string;
        slugId: string;
    }, "page">;
    withSpace(eb: ExpressionBuilder<DB, 'shares'>, userId?: string): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        slug: string;
        userRole?: string;
    }, "space">;
    withUserSpaceRole(eb: ExpressionBuilder<DB, 'spaces'>, userId: string): import("kysely").AliasedSelectQueryBuilder<{
        role: string;
    }, "userRole">;
    withCreator(eb: ExpressionBuilder<DB, 'shares'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }, "creator">;
    withSharedPage(eb: ExpressionBuilder<DB, 'shares'>): import("kysely").AliasedRawBuilder<{
        id: string;
        title: string;
        icon: string;
        parentPageId: string;
        slugId: string;
    }, "sharedPage">;
}
