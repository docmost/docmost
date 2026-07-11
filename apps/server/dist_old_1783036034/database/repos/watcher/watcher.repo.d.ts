import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { InsertableWatcher, Watcher } from "../../types/entity.types";
import { PaginationOptions } from "../../pagination/pagination-options";
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
export declare const WatcherType: {
    readonly PAGE: "page";
    readonly SPACE: "space";
};
export type WatcherType = (typeof WatcherType)[keyof typeof WatcherType];
export declare class WatcherRepo {
    private readonly db;
    constructor(db: KyselyDB);
    findPageWatchers(pageId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        type: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        userId: string;
        addedById: string;
        spaceId: string;
        pageId: string;
        mutedAt: Date;
    } & {
        user: {
            id: string;
            name: string;
            email: string;
            avatarUrl: string;
        };
    }, undefined>>;
    getPageWatcherIds(pageId: string, trx?: KyselyTransaction): Promise<string[]>;
    getPageUpdateRecipientIds(pageId: string, spaceId: string, trx?: KyselyTransaction): Promise<string[]>;
    insert(watcher: InsertableWatcher, trx?: KyselyTransaction): Promise<Watcher | undefined>;
    insertMany(watchers: InsertableWatcher[], trx?: KyselyTransaction): Promise<void>;
    upsert(watcher: InsertableWatcher, trx?: KyselyTransaction): Promise<Watcher | undefined>;
    upsertSpace(watcher: InsertableWatcher, trx?: KyselyTransaction): Promise<Watcher | undefined>;
    mute(userId: string, pageId: string, spaceId: string, workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    deleteSpaceWatch(userId: string, spaceId: string, trx?: KyselyTransaction): Promise<void>;
    getWatchedSpaceIds(userId: string, workspaceId: string): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        spaceId: string;
    }, undefined>>;
    isWatchingSpace(userId: string, spaceId: string): Promise<boolean>;
    isWatching(userId: string, pageId: string): Promise<boolean>;
    countPageWatchers(pageId: string): Promise<number>;
    deleteByUsersWithoutSpaceAccess(userIds: string[], spaceId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
    updateSpaceIdByPageIds(spaceId: string, pageIds: string[], opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
    deleteByPageIdsWithoutSpaceAccess(pageIds: string[], spaceId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
    deleteByUserAndWorkspace(userId: string, workspaceId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
    withUser(eb: ExpressionBuilder<DB, 'watchers'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        email: string;
        avatarUrl: string;
    }, "user">;
}
