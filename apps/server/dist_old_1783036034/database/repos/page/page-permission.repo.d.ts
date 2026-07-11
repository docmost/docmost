import { Cache } from 'cache-manager';
import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { InsertablePageAccess, InsertablePagePermission, PageAccess, PagePermission } from "../../types/entity.types";
import { PaginationOptions } from "../../pagination/pagination-options";
import { GroupRepo } from "../group/group.repo";
import { CursorPaginationResult } from "../../pagination/cursor-pagination";
import { PagePermissionMember } from './types/page-permission.types';
export { PagePermissionMember } from './types/page-permission.types';
export declare class PagePermissionRepo {
    private readonly db;
    private readonly groupRepo;
    private readonly cacheManager;
    constructor(db: KyselyDB, groupRepo: GroupRepo, cacheManager: Cache);
    findPageAccessByPageId(pageId: string, trx?: KyselyTransaction): Promise<PageAccess | undefined>;
    insertPageAccess(data: InsertablePageAccess, trx?: KyselyTransaction): Promise<PageAccess>;
    deletePageAccess(pageId: string, trx?: KyselyTransaction): Promise<void>;
    insertPagePermissions(permissions: InsertablePagePermission[], trx?: KyselyTransaction): Promise<void>;
    findPagePermissionByUserId(pageAccessId: string, userId: string, trx?: KyselyTransaction): Promise<PagePermission | undefined>;
    findPagePermissionByGroupId(pageAccessId: string, groupId: string, trx?: KyselyTransaction): Promise<PagePermission | undefined>;
    deletePagePermissionByUserId(pageAccessId: string, userId: string, trx?: KyselyTransaction): Promise<void>;
    deletePagePermissionByGroupId(pageAccessId: string, groupId: string, trx?: KyselyTransaction): Promise<void>;
    deletePagePermissionsByUserIds(pageAccessId: string, userIds: string[], trx?: KyselyTransaction): Promise<void>;
    deletePagePermissionsByGroupIds(pageAccessId: string, groupIds: string[], trx?: KyselyTransaction): Promise<void>;
    updatePagePermissionRole(pageAccessId: string, role: string, opts: {
        userId?: string;
        groupId?: string;
    }, trx?: KyselyTransaction): Promise<void>;
    countWritersByPageAccessId(pageAccessId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<number>;
    getPagePermissionsPaginated(pageAccessId: string, pagination: PaginationOptions): Promise<CursorPaginationResult<PagePermissionMember>>;
    getUserPagePermission(userId: string, pageId: string): Promise<{
        role: string;
    } | undefined>;
    findRestrictedAncestor(pageId: string): Promise<{
        pageAccessId: string;
        pageId: string;
        accessLevel: string;
        depth: number;
    } | undefined>;
    canUserAccessPage(userId: string, pageId: string): Promise<boolean>;
    canUserEditPage(userId: string, pageId: string): Promise<{
        hasAnyRestriction: boolean;
        canAccess: boolean;
        canEdit: boolean;
    }>;
    getUserPageAccessLevel(userId: string, pageId: string): Promise<{
        hasDirectRestriction: boolean;
        hasInheritedRestriction: boolean;
        hasAnyRestriction: boolean;
        canAccess: boolean;
        canEdit: boolean;
    }>;
    filterAccessiblePageIds(opts: {
        pageIds: string[];
        userId: string;
        spaceId?: string;
    }): Promise<string[]>;
    filterAccessiblePageIdsWithPermissions(pageIds: string[], userId: string): Promise<Array<{
        id: string;
        canEdit: boolean;
    }>>;
    hasRestrictedAncestor(pageId: string): Promise<boolean>;
    hasRestrictedPagesInSpace(spaceId: string): Promise<boolean>;
    getParentIdsWithAccessibleChildren(parentIds: string[], userId: string): Promise<string[]>;
    getRestrictedSubtreeIds(rootPageId: string): Promise<string[]>;
    getUserIdsWithPageAccess(pageId: string, userIds: string[]): Promise<string[]>;
    private userGroupIdsSubquery;
}
