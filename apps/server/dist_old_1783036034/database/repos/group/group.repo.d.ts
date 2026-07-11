import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { Group, InsertableGroup, UpdatableGroup } from "../../types/entity.types";
import { ExpressionBuilder } from 'kysely';
import { PaginationOptions } from '../../pagination/pagination-options';
import { DB } from '@docmost/db/types/db';
export declare class GroupRepo {
    private readonly db;
    constructor(db: KyselyDB);
    private baseFields;
    findById(groupId: string, workspaceId: string, opts?: {
        includeMemberCount?: boolean;
        includeScimExternalId?: boolean;
        trx?: KyselyTransaction;
    }): Promise<Group>;
    findByName(groupName: string, workspaceId: string, opts?: {
        includeMemberCount?: boolean;
        includeScimExternalId?: boolean;
        trx?: KyselyTransaction;
    }): Promise<Group>;
    update(updatableGroup: UpdatableGroup, groupId: string, workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    insertGroup(insertableGroup: InsertableGroup, trx?: KyselyTransaction): Promise<Group>;
    getDefaultGroup(workspaceId: string, trx: KyselyTransaction): Promise<Group>;
    createDefaultGroup(workspaceId: string, opts?: {
        userId?: string;
        trx?: KyselyTransaction;
    }): Promise<Group>;
    getGroupsPaginated(workspaceId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        description: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        name: string;
        scimExternalId: string;
        isDefault: boolean;
        isExternal: boolean;
        memberCount: string | number | bigint;
    }, undefined>>;
    withMemberCount(eb: ExpressionBuilder<DB, 'groups'>): import("kysely").AliasedSelectQueryBuilder<{
        count: string | number | bigint;
    }, "memberCount">;
    delete(groupId: string, workspaceId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
}
