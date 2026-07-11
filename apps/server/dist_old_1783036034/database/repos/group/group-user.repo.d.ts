import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { GroupUser, InsertableGroupUser } from "../../types/entity.types";
import { PaginationOptions } from '../../pagination/pagination-options';
import { GroupRepo } from "./group.repo";
import { UserRepo } from "../user/user.repo";
export declare class GroupUserRepo {
    private readonly db;
    private readonly groupRepo;
    private readonly userRepo;
    constructor(db: KyselyDB, groupRepo: GroupRepo, userRepo: UserRepo);
    getGroupUserById(userId: string, groupId: string, trx?: KyselyTransaction): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        groupId: string;
    }>;
    insertGroupUser(insertableGroupUser: InsertableGroupUser, trx?: KyselyTransaction): Promise<GroupUser>;
    getGroupUsersPaginated(groupId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        password: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        role: string;
        name: string;
        settings: import("../../types/db").JsonValue;
        email: string;
        invitedById: string;
        avatarUrl: string;
        deactivatedAt: Date;
        emailVerifiedAt: Date;
        lastActiveAt: Date;
        lastLoginAt: Date;
        locale: string;
        hasGeneratedPassword: boolean;
        scimExternalId: string;
        timezone: string;
    }, undefined>>;
    addUserToGroup(userId: string, groupId: string, workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    addUserToDefaultGroup(userId: string, workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    getUserIdsByGroupId(groupId: string): Promise<string[]>;
    delete(userId: string, groupId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
    getUserGroupIds(userId: string): Promise<string[]>;
}
