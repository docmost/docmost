import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { InsertablePage, Page, UpdatablePage } from "../../types/entity.types";
import { PaginationOptions } from "../../pagination/pagination-options";
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { SpaceMemberRepo } from "../space/space-member.repo";
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class PageRepo {
    private readonly db;
    private spaceMemberRepo;
    private eventEmitter;
    constructor(db: KyselyDB, spaceMemberRepo: SpaceMemberRepo, eventEmitter: EventEmitter2);
    private baseFields;
    findById(pageId: string, opts?: {
        includeContent?: boolean;
        includeTextContent?: boolean;
        includeYdoc?: boolean;
        includeSpace?: boolean;
        includeCreator?: boolean;
        includeLastUpdatedBy?: boolean;
        includeContributors?: boolean;
        includeDeletedBy?: boolean;
        includeHasChildren?: boolean;
        withLock?: boolean;
        trx?: KyselyTransaction;
    }): Promise<Page>;
    findManyByIds(pageIds: string[], opts?: {
        trx?: KyselyTransaction;
        workspaceId?: string;
    }): Promise<Page[]>;
    updatePage(updatablePage: UpdatablePage, pageId: string, trx?: KyselyTransaction): Promise<import("kysely").UpdateResult>;
    updatePages(updatePageData: UpdatablePage, pageIds: string[], trx?: KyselyTransaction): Promise<import("kysely").UpdateResult>;
    insertPage(insertablePage: InsertablePage, trx?: KyselyTransaction): Promise<Page>;
    deletePage(pageId: string): Promise<void>;
    removePage(pageId: string, deletedById: string, workspaceId: string): Promise<void>;
    restorePage(pageId: string, workspaceId: string): Promise<void>;
    getRecentPagesInSpace(spaceId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        workspaceId: string;
        creatorId: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        content: import("@docmost/db/types/db").JsonValue;
        metadata: string | number | boolean | import("@docmost/db/types/db").JsonArray | import("@docmost/db/types/db").JsonObject;
        tsv: string;
        spaceId: string;
        contributorIds: string[];
        coverPhoto: string;
        deletedById: string;
        icon: string;
        isLocked: boolean;
        lastUpdatedById: string;
        parentPageId: string;
        position: string;
        slugId: string;
        textContent: string;
        ydoc: Buffer<ArrayBufferLike>;
    } & {
        space: {
            id: string;
            name: string;
            slug: string;
        };
    }, undefined>>;
    getRecentPages(userId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        workspaceId: string;
        creatorId: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        content: import("@docmost/db/types/db").JsonValue;
        metadata: string | number | boolean | import("@docmost/db/types/db").JsonArray | import("@docmost/db/types/db").JsonObject;
        tsv: string;
        spaceId: string;
        contributorIds: string[];
        coverPhoto: string;
        deletedById: string;
        icon: string;
        isLocked: boolean;
        lastUpdatedById: string;
        parentPageId: string;
        position: string;
        slugId: string;
        textContent: string;
        ydoc: Buffer<ArrayBufferLike>;
    } & {
        space: {
            id: string;
            name: string;
            slug: string;
        };
    }, undefined>>;
    getCreatedByPages(creatorId: string, requestingUserId: string, pagination: PaginationOptions, spaceId?: string): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        workspaceId: string;
        creatorId: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        content: import("@docmost/db/types/db").JsonValue;
        metadata: string | number | boolean | import("@docmost/db/types/db").JsonArray | import("@docmost/db/types/db").JsonObject;
        tsv: string;
        spaceId: string;
        contributorIds: string[];
        coverPhoto: string;
        deletedById: string;
        icon: string;
        isLocked: boolean;
        lastUpdatedById: string;
        parentPageId: string;
        position: string;
        slugId: string;
        textContent: string;
        ydoc: Buffer<ArrayBufferLike>;
    } & {
        space: {
            id: string;
            name: string;
            slug: string;
        };
    }, undefined>>;
    getDeletedPagesInSpace(spaceId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        workspaceId: string;
        creatorId: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        content: import("@docmost/db/types/db").JsonValue;
        metadata: string | number | boolean | import("@docmost/db/types/db").JsonArray | import("@docmost/db/types/db").JsonObject;
        tsv: string;
        spaceId: string;
        contributorIds: string[];
        coverPhoto: string;
        deletedById: string;
        icon: string;
        isLocked: boolean;
        lastUpdatedById: string;
        parentPageId: string;
        position: string;
        slugId: string;
        textContent: string;
        ydoc: Buffer<ArrayBufferLike>;
    } & {
        content: import("@docmost/db/types/db").JsonValue;
    } & {
        space: {
            id: string;
            name: string;
            slug: string;
        };
    } & {
        deletedBy: {
            id: string;
            name: string;
            avatarUrl: string;
        };
    }, undefined>>;
    withSpace(eb: ExpressionBuilder<DB, 'pages'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        slug: string;
    }, "space">;
    withCreator(eb: ExpressionBuilder<DB, 'pages'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }, "creator">;
    withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pages'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }, "lastUpdatedBy">;
    withDeletedBy(eb: ExpressionBuilder<DB, 'pages'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }, "deletedBy">;
    withContributors(eb: ExpressionBuilder<DB, 'pages'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }[], "contributors">;
    withHasChildren(eb: ExpressionBuilder<DB, 'pages'>): import("kysely").AliasedSelectQueryBuilder<{
        count: boolean;
    }, "hasChildren">;
    getPageAndDescendants(parentPageId: string, opts: {
        includeContent: boolean;
    }): Promise<{
        id: string;
        workspaceId: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        content: import("@docmost/db/types/db").JsonValue;
        metadata: string | number | boolean | import("@docmost/db/types/db").JsonArray | import("@docmost/db/types/db").JsonObject;
        spaceId: string;
        icon: string;
        parentPageId: string;
        position: string;
        slugId: string;
    }[]>;
    getPageAndDescendantsExcludingRestricted(parentPageId: string, opts: {
        includeContent: boolean;
    }): Promise<{
        id: string;
        workspaceId: string;
        title: string;
        spaceId: string;
        icon: string;
        parentPageId: string;
        position: string;
        slugId: string;
        content?: import("@docmost/db/types/db").JsonValue;
    }[]>;
}
