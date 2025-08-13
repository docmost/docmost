import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { sql } from 'kysely';
import {
  InsertablePagePermission,
  PagePermission,
  UpdatablePagePermission,
} from '../../types/entity.types';
import { PaginationOptions } from '../../pagination/pagination-options';
import { executeWithPagination } from '../../pagination/pagination';
import { GroupRepo } from '../group/group.repo';
import { PageRepo } from './page.repo';
import { dbOrTx } from '@docmost/db/utils';

export interface UserPageRole {
  userId: string;
  role: string;
}

export interface MemberInfo {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  memberCount?: number;
  isDefault?: boolean;
  type: 'user' | 'group';
}

export enum PageMemberRole {
  ADMIN = 'admin',
  WRITER = 'writer',
  READER = 'reader',
  NONE = 'none',
}

@Injectable()
export class PagePermissionRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly groupRepo: GroupRepo,
    private readonly pageRepo: PageRepo,
  ) {}

  async insertPageMember(
    insertablePageMember: InsertablePagePermission,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .insertInto('pagePermissions')
      .values(insertablePageMember)
      .returningAll()
      .execute();
  }

  async upsertPageMember(
    insertablePageMember: InsertablePagePermission,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);

    // Check if member exists
    const existing = await this.getPageMemberByTypeId(
      insertablePageMember.pageId,
      {
        userId: insertablePageMember.userId,
        groupId: insertablePageMember.groupId,
      },
      trx,
    );

    if (existing) {
      // Update existing member
      await db
        .updateTable('pagePermissions')
        .set({ role: insertablePageMember.role, updatedAt: new Date() })
        .where('id', '=', existing.id)
        .execute();
    } else {
      // Insert new member
      await this.insertPageMember(insertablePageMember, trx);
    }
  }

  async updatePageMember(
    updatablePageMember: UpdatablePagePermission,
    pageMemberId: string,
    pageId: string,
  ): Promise<void> {
    await this.db
      .updateTable('pagePermissions')
      .set(updatablePageMember)
      .where('id', '=', pageMemberId)
      .where('pageId', '=', pageId)
      .execute();
  }

  async getPageMemberByTypeId(
    pageId: string,
    opts: {
      userId?: string;
      groupId?: string;
    },
    trx?: KyselyTransaction,
  ): Promise<PagePermission> {
    const db = dbOrTx(this.db, trx);
    let query = db
      .selectFrom('pagePermissions')
      .selectAll()
      .where('pageId', '=', pageId);
    if (opts.userId) {
      query = query.where('userId', '=', opts.userId);
    } else if (opts.groupId) {
      query = query.where('groupId', '=', opts.groupId);
    } else {
      throw new BadRequestException('Please provide a userId or groupId');
    }
    return query.executeTakeFirst();
  }
  ////////
  //// get page permission start with user, not group.

  async getUserPagePermission(opts: {
    pageId: string;
    userId: string;
  }): Promise<PagePermission[]> {
    // Query traverses the page hierarchy and returns ALL permissions found at the closest level
    // This handles cases where user has multiple permissions (direct + multiple groups)
    // Returns all permissions regardless of cascade value - cascade check is done in the calling code
    
    // First, get the page hierarchy with levels
    const pageHierarchy = await this.db
      .withRecursive('page_hierarchy', (qb) =>
        qb
          .selectFrom('pages')
          .select(['id as pageId', 'parentPageId', sql<number>`0`.as('level')])
          .where('id', '=', opts.pageId)
          .where('deletedAt', 'is', null)
          .unionAll((eb) =>
            eb
              .selectFrom('pages as p')
              .innerJoin('page_hierarchy as ph', 'p.id', 'ph.parentPageId')
              .select([
                'p.id as pageId',
                'p.parentPageId',
                sql<number>`ph.level + 1`.as('level'),
              ])
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('page_hierarchy')
      .selectAll()
      .orderBy('level', 'asc')
      .execute();

    // Check each level for permissions, starting from the current page
    for (const page of pageHierarchy) {
      const permissions = await this.db
        .selectFrom('pagePermissions as pp')
        .leftJoin('groupUsers as gu', (join) =>
          join
            .onRef('gu.groupId', '=', 'pp.groupId')
            .on('gu.userId', '=', opts.userId),
        )
        .selectAll('pp')
        .where('pp.pageId', '=', page.pageId)
        .where('pp.deletedAt', 'is', null)
        .where((eb) =>
          eb.or([
            eb('pp.userId', '=', opts.userId),
            eb('gu.userId', '=', opts.userId),
          ]),
        )
        .execute();

      // If we found permissions at this level, return them all
      if (permissions.length > 0) {
        return permissions;
      }
    }

    // No permissions found in the hierarchy
    return [];
  }

  ///////

  async removePageMemberById(
    memberId: string,
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pagePermissions')
      .where('id', '=', memberId)
      .where('pageId', '=', pageId)
      .execute();
  }

  async roleCountByPageId(role: string, pageId: string): Promise<number> {
    const { count } = await this.db
      .selectFrom('pagePermissions')
      .select((eb) => eb.fn.count('role').as('count'))
      .where('role', '=', role)
      .where('pageId', '=', pageId)
      .executeTakeFirst();

    return count as number;
  }

  async getPageMembers(pageId: string): Promise<PagePermission[]> {
    return await this.db
      .selectFrom('pagePermissions')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async getPageMembersPaginated(pageId: string, pagination: PaginationOptions) {
    let query = this.db
      .selectFrom('pagePermissions')
      .leftJoin('users', 'users.id', 'pagePermissions.userId')
      .leftJoin('groups', 'groups.id', 'pagePermissions.groupId')
      .select([
        'pagePermissions.id',
        'users.id as userId',
        'users.name as userName',
        'users.avatarUrl as userAvatarUrl',
        'users.email as userEmail',
        'groups.id as groupId',
        'groups.name as groupName',
        'groups.isDefault as groupIsDefault',
        'pagePermissions.role',
        'pagePermissions.createdAt',
      ])
      .select((eb) => this.groupRepo.withMemberCount(eb))
      .where('pageId', '=', pageId)
      .orderBy((eb) => eb('groups.id', 'is not', null), 'desc')
      .orderBy('pagePermissions.createdAt', 'asc');

    if (pagination.query) {
      query = query.where((eb) =>
        eb(
          sql`f_unaccent(users.name)`,
          'ilike',
          sql`f_unaccent(${'%' + pagination.query + '%'})`,
        )
          .or(
            sql`users.email`,
            'ilike',
            sql`f_unaccent(${'%' + pagination.query + '%'})`,
          )
          .or(
            sql`f_unaccent(groups.name)`,
            'ilike',
            sql`f_unaccent(${'%' + pagination.query + '%'})`,
          ),
      );
    }

    const result = await executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    let memberInfo: MemberInfo;

    const members = result.items.map((member) => {
      if (member.userId) {
        memberInfo = {
          id: member.userId,
          name: member.userName,
          email: member.userEmail,
          avatarUrl: member.userAvatarUrl,
          type: 'user',
        };
      } else if (member.groupId) {
        memberInfo = {
          id: member.groupId,
          name: member.groupName,
          memberCount: member.memberCount as number,
          isDefault: member.groupIsDefault,
          type: 'group',
        };
      }

      return {
        id: member.id,
        ...memberInfo,
        role: member.role,
        createdAt: member.createdAt,
      };
    });

    result.items = members as any;

    return result;
  }

  async getUserPageRoles(
    userId: string,
    pageId: string,
  ): Promise<UserPageRole[]> {
    const roles = await this.db
      .selectFrom('pagePermissions')
      .select(['userId', 'role'])
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .unionAll(
        this.db
          .selectFrom('pagePermissions')
          .innerJoin(
            'groupUsers',
            'groupUsers.groupId',
            'pagePermissions.groupId',
          )
          .select(['groupUsers.userId', 'pagePermissions.role'])
          .where('groupUsers.userId', '=', userId)
          .where('pagePermissions.pageId', '=', pageId)
          .where('pagePermissions.deletedAt', 'is', null),
      )
      .execute();

    if (!roles || roles.length === 0) {
      return undefined;
    }
    return roles;
  }

  async resolveUserPageAccess(
    userId: string,
    pageId: string,
  ): Promise<string | null> {
    // Use batch method for efficiency - single page is just a batch of 1
    const accessMap = await this.resolveUserPageAccessBatch(userId, [pageId]);
    return accessMap.get(pageId) || null;
  }

  async resolveUserPageAccessBatch(
    userId: string,
    pageIds: string[],
  ): Promise<Map<string, string | null>> {
    if (pageIds.length === 0) {
      return new Map();
    }

    // Get all pages and their complete ancestor chains using recursive CTE
    const pagesWithAncestors = await this.db
      .withRecursive('page_tree', (qb) =>
        qb
          .selectFrom('pages')
          .select([
            'id',
            'parentPageId',
            //  'hasCustomPermissions',
            // 'inheritPermissions',
          ])
          .where('id', 'in', pageIds)
          .unionAll((eb) =>
            eb
              .selectFrom('pages as p')
              .innerJoin('page_tree as pt', 'p.id', 'pt.parentPageId')
              .select([
                'p.id',
                'p.parentPageId',
                //'p.hasCustomPermissions',
                //'p.inheritPermissions',
              ])
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('page_tree')
      .selectAll()
      .execute();

    console.log('pages', pagesWithAncestors);

    // Build page hierarchy map
    const pageMap = new Map(pagesWithAncestors.map((p) => [p.id, p]));
    const allPageIds = Array.from(pageMap.keys());

    // Get ALL permissions (including ancestors) for user in ONE query
    const allPermissions = await this.db
      .selectFrom('pagePermissions as pm')
      .leftJoin('groupUsers as gu', (join) =>
        join
          .on('gu.userId', '=', userId)
          .onRef('gu.groupId', '=', 'pm.groupId'),
      )
      .select(['pm.pageId', 'pm.role'])
      .where('pm.pageId', 'in', allPageIds) // Include ancestor pages
      .where('pm.deletedAt', 'is', null)
      .where((eb) =>
        eb.or([eb('pm.userId', '=', userId), eb('gu.userId', '=', userId)]),
      )
      .execute();

    console.log('all permissions', allPermissions);

    // Build permission map
    const permissionMap = new Map<string, string[]>();
    allPermissions.forEach((p) => {
      if (!permissionMap.has(p.pageId)) {
        permissionMap.set(p.pageId, []);
      }
      permissionMap.get(p.pageId).push(p.role);
    });

    // Process each requested page
    const accessMap = new Map<string, string | null>();

    for (const pageId of pageIds) {
      const page = pageMap.get(pageId);
      if (!page) {
        accessMap.set(pageId, null);
        continue;
      }

      // Build ancestor chain
      const ancestorChain: string[] = [];
      let current = page;
      while (current?.parentPageId) {
        ancestorChain.push(current.parentPageId);
        current = pageMap.get(current.parentPageId);
      }

      // Check for ancestor NONE
      let hasAncestorDenial = false;
      for (const ancestorId of ancestorChain) {
        const ancestorRoles = permissionMap.get(ancestorId) || [];
        if (ancestorRoles.includes(PageMemberRole.NONE)) {
          hasAncestorDenial = true;
          break;
        }
      }

      const pageRoles = permissionMap.get(pageId) || [];

      // Apply cascade logic
      if (hasAncestorDenial) {
        if (!pageRoles.length) {
          accessMap.set(pageId, PageMemberRole.NONE); // Inherit denial
        } else if (pageRoles.includes(PageMemberRole.NONE)) {
          accessMap.set(pageId, PageMemberRole.NONE); // Explicit denial
        } else {
          // Override with explicit permission
          accessMap.set(pageId, this.findHighestRoleFromStrings(pageRoles));
        }
      } else {
        // No ancestor denial
        if (pageRoles.includes(PageMemberRole.NONE)) {
          accessMap.set(pageId, PageMemberRole.NONE);
        } else if (pageRoles.length > 0) {
          accessMap.set(pageId, this.findHighestRoleFromStrings(pageRoles));
        } else {
          accessMap.set(pageId, null);
        }
      }
    }

    return accessMap;
  }

  async getUserPageIds(userId: string): Promise<string[]> {
    const membership = await this.db
      .selectFrom('pagePermissions')
      .innerJoin('pages', 'pages.id', 'pagePermissions.pageId')
      .select(['pages.id'])
      .where('userId', '=', userId)
      .where('pagePermissions.role', '!=', PageMemberRole.NONE)
      .where('pagePermissions.deletedAt', 'is', null)
      .union(
        this.db
          .selectFrom('pagePermissions')
          .innerJoin(
            'groupUsers',
            'groupUsers.groupId',
            'pagePermissions.groupId',
          )
          .innerJoin('pages', 'pages.id', 'pagePermissions.pageId')
          .select(['pages.id'])
          .where('groupUsers.userId', '=', userId)
          .where('pagePermissions.role', '!=', PageMemberRole.NONE)
          .where('pagePermissions.deletedAt', 'is', null),
      )
      .execute();

    return membership.map((page) => page.id);
  }

  async getUserAccessiblePageIds(
    userId: string,
    spaceId: string,
    pageIds: string[],
  ): Promise<Set<string>> {
    // Single query to get all page permissions for user
    const accessiblePages = await this.db
      .selectFrom('pages as p')
      .leftJoin('pagePermissions as pm', 'pm.pageId', 'p.id')
      .leftJoin('groupUsers as gu', (join) =>
        join
          .on('gu.userId', '=', userId)
          .onRef('gu.groupId', '=', 'pm.groupId'),
      )
      .select([
        'p.id',
        // 'p.hasCustomPermissions',
        //'p.inheritPermissions',
        'pm.role',
      ])
      .where('p.id', 'in', pageIds)
      .where('p.spaceId', '=', spaceId)
      .where((eb) =>
        eb.or([
          // Pages without custom permissions (inherit from space)
          // eb('p.hasCustomPermissions', '=', false),
          // Pages with custom permissions where user has direct access
          eb.and([
            //  eb('p.hasCustomPermissions', '=', true),
            eb('pm.userId', '=', userId),
            eb('pm.role', '!=', PageMemberRole.NONE),
            eb('pm.deletedAt', 'is', null),
          ]),
          // Pages with custom permissions where user has group access
          eb.and([
            //  eb('p.hasCustomPermissions', '=', true),
            eb('gu.userId', '=', userId),
            eb('pm.role', '!=', PageMemberRole.NONE),
            eb('pm.deletedAt', 'is', null),
          ]),
          // Pages that inherit and user has space access (checked separately)
          eb.and([
            // eb('p.hasCustomPermissions', '=', true),
            // eb('p.inheritPermissions', '=', true),
          ]),
        ]),
      )
      .execute();

    // Also need to exclude pages where user has explicit "none" role
    const blockedPageIds = await this.db
      .selectFrom('pagePermissions as pm')
      .leftJoin('groupUsers as gu', (join) =>
        join
          .on('gu.userId', '=', userId)
          .onRef('gu.groupId', '=', 'pm.groupId'),
      )
      .select('pm.pageId')
      .where('pm.pageId', 'in', pageIds)
      .where('pm.role', '=', PageMemberRole.NONE)
      .where('pm.deletedAt', 'is', null)
      .where((eb) =>
        eb.or([eb('pm.userId', '=', userId), eb('gu.userId', '=', userId)]),
      )
      .execute();

    const blockedSet = new Set(blockedPageIds.map((p) => p.pageId));
    return new Set(
      accessiblePages.filter((p) => !blockedSet.has(p.id)).map((p) => p.id),
    );
  }

  private findHighestRole(roles: UserPageRole[]): string | null {
    if (!roles || roles.length === 0) {
      return null;
    }

    const roleValues = roles.map((r) => r.role);
    return this.findHighestRoleFromStrings(roleValues);
  }

  private findHighestRoleFromStrings(roles: string[]): string | null {
    if (roles.includes(PageMemberRole.ADMIN)) {
      return PageMemberRole.ADMIN;
    }
    if (roles.includes(PageMemberRole.WRITER)) {
      return PageMemberRole.WRITER;
    }
    if (roles.includes(PageMemberRole.READER)) {
      return PageMemberRole.READER;
    }
    return null;
  }
}
