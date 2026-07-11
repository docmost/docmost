import { Backlink, InsertableBacklink, UpdatableBacklink } from "../../types/entity.types";
import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { PaginationOptions } from "../../pagination/pagination-options";
import { SpaceMemberRepo } from "../space/space-member.repo";
export declare class BacklinkRepo {
    private readonly db;
    private readonly spaceMemberRepo;
    constructor(db: KyselyDB, spaceMemberRepo: SpaceMemberRepo);
    findById(backlinkId: string, workspaceId: string, trx?: KyselyTransaction): Promise<Backlink>;
    insertBacklink(insertableBacklink: InsertableBacklink, trx?: KyselyTransaction): Promise<{
        id: string;
        workspaceId: string;
        createdAt: Date;
        updatedAt: Date;
        sourcePageId: string;
        targetPageId: string;
    }>;
    updateBacklink(updatableBacklink: UpdatableBacklink, backlinkId: string, trx?: KyselyTransaction): Promise<import("kysely").UpdateResult[]>;
    deleteBacklink(backlinkId: string, trx?: KyselyTransaction): Promise<void>;
    findRelatedPageIds(pageId: string, direction: 'incoming' | 'outgoing', userId: string): Promise<string[]>;
    findPagesByIdsPaginated(pageIds: string[], pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        slugId: string;
        title: string | null;
        icon: string | null;
        spaceId: string;
        updatedAt: Date;
        space: {
            id: string;
            slug: string;
            name: string;
        } | null;
    }, undefined>>;
}
