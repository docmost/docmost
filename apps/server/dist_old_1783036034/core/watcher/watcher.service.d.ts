import { WatcherRepo } from "../../database/repos/watcher/watcher.repo";
import { PaginationOptions } from "../../database/pagination/pagination-options";
import { KyselyTransaction } from "../../database/types/kysely.types";
import { SpaceMemberRepo } from "../../database/repos/space/space-member.repo";
export declare class WatcherService {
    private readonly watcherRepo;
    private readonly spaceMemberRepo;
    constructor(watcherRepo: WatcherRepo, spaceMemberRepo: SpaceMemberRepo);
    watchPage(userId: string, pageId: string, spaceId: string, workspaceId: string, trx?: KyselyTransaction): Promise<{
        type: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        userId: string;
        addedById: string;
        spaceId: string;
        pageId: string;
        mutedAt: Date;
    }>;
    addPageWatchers(userIds: string[], pageId: string, spaceId: string, workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    unwatchPage(userId: string, pageId: string, spaceId: string, workspaceId: string): Promise<void>;
    isWatchingPage(userId: string, pageId: string): Promise<boolean>;
    watchSpace(userId: string, spaceId: string, workspaceId: string, trx?: KyselyTransaction): Promise<{
        type: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        userId: string;
        addedById: string;
        spaceId: string;
        pageId: string;
        mutedAt: Date;
    }>;
    unwatchSpace(userId: string, spaceId: string): Promise<void>;
    getWatchedSpaceIds(userId: string, workspaceId: string): Promise<{
        items: string[];
        meta: {
            limit: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
            nextCursor: string | null;
            prevCursor: string | null;
        };
    }>;
    isWatchingSpace(userId: string, spaceId: string): Promise<boolean>;
    getPageWatchers(pageId: string, pagination: PaginationOptions): Promise<import("../../database/pagination/cursor-pagination").CursorPaginationResult<{
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
    countPageWatchers(pageId: string): Promise<number>;
    cleanupOnSpaceAccessChange(userIds: string[], spaceId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
    movePageWatchersToSpace(pageIds: string[], spaceId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
}
