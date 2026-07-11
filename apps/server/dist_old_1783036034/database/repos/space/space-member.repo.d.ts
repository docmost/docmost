import { Cache } from 'cache-manager';
import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { InsertableSpaceMember, SpaceMember, UpdatableSpaceMember } from "../../types/entity.types";
import { PaginationOptions } from '../../pagination/pagination-options';
import { UserSpaceRole } from './types';
import { GroupRepo } from "../group/group.repo";
import { SpaceRepo } from "./space.repo";
export declare class SpaceMemberRepo {
    private readonly db;
    private readonly groupRepo;
    private readonly spaceRepo;
    private readonly cacheManager;
    constructor(db: KyselyDB, groupRepo: GroupRepo, spaceRepo: SpaceRepo, cacheManager: Cache);
    insertSpaceMember(insertableSpaceMember: InsertableSpaceMember, trx?: KyselyTransaction): Promise<void>;
    updateSpaceMember(updatableSpaceMember: UpdatableSpaceMember, spaceMemberId: string, spaceId: string): Promise<void>;
    getSpaceMemberByTypeId(spaceId: string, opts: {
        userId?: string;
        groupId?: string;
    }, trx?: KyselyTransaction): Promise<SpaceMember>;
    removeSpaceMemberById(memberId: string, spaceId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<void>;
    roleCountBySpaceId(role: string, spaceId: string): Promise<number>;
    getSpaceMembersPaginated(spaceId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        createdAt: Date;
        userId: string;
        role: string;
        groupId: string;
        memberCount: string | number | bigint;
        userName: string;
        userAvatarUrl: string;
        userEmail: string;
        groupName: string;
        groupIsDefault: boolean;
        isGroup: number;
        roleOrder: number;
        memberName: string;
    }, undefined>>;
    getUserSpaceRoles(userId: string, spaceId: string): Promise<UserSpaceRole[]>;
    getUserIdsWithSpaceAccess(userIds: string[], spaceId: string): Promise<Set<string>>;
    getSpaceIdsByGroupId(groupId: string): Promise<string[]>;
    getUserSpaceIdsQuery(userId: string): import("kysely").SelectQueryBuilder<import("../../types/db.interface").DbInterface, "spaceMembers" | "spaces", {
        id: string;
    }>;
    getUserSpaceIds(userId: string): Promise<string[]>;
    getUserRolesForSpaces(userId: string, spaceIds: string[]): Promise<{
        spaceId: string;
        role: string;
    }[]>;
    getUserSpaces(userId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
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
        settings: import("../../types/db").JsonValue;
        slug: string;
        visibility: string;
    } & {
        memberCount: string | number | bigint;
    }, undefined>>;
}
