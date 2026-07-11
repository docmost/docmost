import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { InsertableSpace, Space, UpdatableSpace } from "../../types/entity.types";
import { ExpressionBuilder } from 'kysely';
import { PaginationOptions } from '../../pagination/pagination-options';
import { DB } from '@docmost/db/types/db';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class SpaceRepo {
    private readonly db;
    private eventEmitter;
    constructor(db: KyselyDB, eventEmitter: EventEmitter2);
    findById(spaceId: string, workspaceId: string, opts?: {
        includeMemberCount?: boolean;
        trx?: KyselyTransaction;
    }): Promise<Space>;
    findBySlug(slug: string, workspaceId: string, opts?: {
        includeMemberCount: boolean;
    }): Promise<Space>;
    slugExists(slug: string, workspaceId: string, trx?: KyselyTransaction): Promise<boolean>;
    updateSpace(updatableSpace: UpdatableSpace, spaceId: string, workspaceId: string, trx?: KyselyTransaction): Promise<{
        description: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        defaultRole: string;
        logo: string;
        name: string;
        settings: import("@docmost/db/types/db").JsonValue;
        slug: string;
        visibility: string;
    }>;
    updateSharingSettings(spaceId: string, workspaceId: string, prefKey: string, prefValue: string | boolean, trx?: KyselyTransaction): Promise<{
        description: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        defaultRole: string;
        logo: string;
        name: string;
        settings: import("@docmost/db/types/db").JsonValue;
        slug: string;
        visibility: string;
    }>;
    updateCommentSettings(spaceId: string, workspaceId: string, prefKey: string, prefValue: string | boolean, trx?: KyselyTransaction): Promise<{
        description: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        defaultRole: string;
        logo: string;
        name: string;
        settings: import("@docmost/db/types/db").JsonValue;
        slug: string;
        visibility: string;
    }>;
    insertSpace(insertableSpace: InsertableSpace, trx?: KyselyTransaction): Promise<Space>;
    getSpacesInWorkspace(workspaceId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        description: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        defaultRole: string;
        logo: string;
        name: string;
        settings: import("@docmost/db/types/db").JsonValue;
        slug: string;
        visibility: string;
    } & {
        memberCount: string | number | bigint;
    }, undefined>>;
    withMemberCount(eb: ExpressionBuilder<DB, 'spaces'>): import("kysely").AliasedSelectQueryBuilder<{
        count: string | number | bigint;
    }, "memberCount">;
    deleteSpace(spaceId: string, workspaceId: string): Promise<void>;
}
