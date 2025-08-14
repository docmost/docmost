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

  /**
   * Determines if a user has access to a specific page considering page-level restrictions.
   *
   * This method implements a hierarchical permission model similar to Atlassian Confluence:
   * 1. Traverses the page hierarchy from target page to root
   * 2. Identifies the closest restricted ancestor (or the page itself if restricted)
   * 3. Checks user permissions (direct or via groups) on the restricted page
   * 4. Applies cascade rules for inherited permissions
   *
   * @param opts.pageId - The ID of the page to check access for
   * @param opts.userId - The ID of the user requesting access
   *
   * @returns Object containing:
   *   - hasAccess: Whether the user can access the page
   *   - role: The highest role granted to the user (admin > writer > reader)
   *   - isRestricted: Whether the page or any ancestor has restrictions
   *   - restrictedPageId/Title: Information about the restricting page
   *   - inheritedFrom: If permission is inherited, the ID of the source page
   *   - permissions: Detailed list of all applicable permissions
   *
   * @example
   * // Check if user can access a page
   * const access = await repo.getUserPagePermission({
   *   pageId: 'page-123',
   *   userId: 'user-456'
   * });
   * if (access.hasAccess) {
   *   console.log(`User has ${access.role} access`);
   * }
   */
  async getUserPagePermission(opts: {
    pageId: string;
    userId: string;
  }): Promise<{
    hasAccess: boolean;
    role?: string;
    restrictedPageId?: string;
    restrictedPageTitle?: string;
    isRestricted: boolean;
    isInherited?: boolean;
    inheritedFrom?: string;
    permissions?: Array<{
      role: string;
      source: 'direct' | 'group';
      groupId?: string;
      cascade?: boolean;
    }>;
  }> {
    // TODO: to
    // first we have to check if the page is restricted and by whom
    // we have to check both the page and all its ancestors if they have the is_restricted permission.
    //  if the page is not restricted directly or by its ancestors, we return access to the page and fall back to the space level permission.

    //If the page inherits permission from an ancestor,
    // we have to get the id and info of that ancestor.
    //then we want the code below, check if the userId, has access to that permissioned pageId, either directly or via a group.
    // then we return all the permissions, so we can select the highest role to grant the user access with in js
    // if not, then we return faled access. they dont have access

    // Performance-optimized implementation using a single query with recursive CTEs
    // This approach minimizes database round-trips which is critical for permission checks

    try {
      const result = await this.db
        .withRecursive('page_hierarchy', (qb) =>
          qb
            // Start with the target page
            .selectFrom('pages')
            .select([
              'id',
              'parentPageId',
              'title',
              'isRestricted',
              'restrictedById',
              sql<number>`0`.as('level'),
              sql<string>`id`.as('originalPageId'),
            ])
            .where('id', '=', opts.pageId)
            .where('deletedAt', 'is', null)
            .unionAll((eb) =>
              // Recursively traverse up the page tree
              eb
                .selectFrom('pages as p')
                .innerJoin('page_hierarchy as ph', 'p.id', 'ph.parentPageId')
                .select([
                  'p.id',
                  'p.parentPageId',
                  'p.title',
                  'p.isRestricted',
                  'p.restrictedById',
                  sql<number>`ph.level + 1`.as('level'),
                  'ph.originalPageId',
                ])
                .where('p.deletedAt', 'is', null),
            ),
        )
        .with('restricted_page', (qb) =>
          // Find the first restricted page in the hierarchy (lowest level = closest to target)
          qb
            .selectFrom('page_hierarchy')
            .selectAll()
            .where('isRestricted', '=', true)
            .orderBy('level', 'asc')
            .limit(1),
        )
        .with('user_permissions', (qb) =>
          // Get all permissions for the user on the restricted page (direct + group-based)
          qb
            .selectFrom('restricted_page as rp')
            .leftJoin('pagePermissions as pp', 'pp.pageId', 'rp.id')
            .leftJoin('groupUsers as gu', (join) =>
              join
                .onRef('gu.groupId', '=', 'pp.groupId')
                .on('gu.userId', '=', opts.userId),
            )
            .select([
              'pp.role',
              'pp.cascade',
              'pp.userId',
              'pp.groupId',
              'rp.id as restrictedPageId',
              'rp.title as restrictedPageTitle',
              'rp.level',
              sql<string>`CASE 
              WHEN pp.user_id IS NOT NULL THEN 'direct'
              WHEN gu.user_id IS NOT NULL THEN 'group'
              ELSE NULL
            END`.as('source'),
            ])
            .where('pp.deletedAt', 'is', null)
            .where((eb) =>
              eb.or([
                eb('pp.userId', '=', opts.userId),
                eb('gu.userId', '=', opts.userId),
              ]),
            ),
        )
        // Final query - combine CTEs to get all relevant data
        .selectFrom('page_hierarchy as ph')
        .leftJoin(
          'restricted_page as rp',
          (join) => join.onRef('ph.id', '=', 'ph.id'), // Self-join to include all rows
        )
        .leftJoin('user_permissions as up', (join) =>
          join.onRef('rp.id', '=', 'up.restrictedPageId'),
        )
        .select([
          'ph.id',
          'ph.isRestricted',
          'rp.id as restrictedPageId',
          'rp.title as restrictedPageTitle',
          'rp.level as restrictedLevel',
          'up.role',
          'up.source',
          'up.groupId',
          'up.cascade',
        ])
        .where('ph.level', '=', 0) // Only get the original page
        .execute();

      console.log(result);

      if (!result || result.length === 0) {
        // Page not found or deleted
        return {
          hasAccess: false,
          isRestricted: false,
        };
      }

      const pageData = result[0];

      // If no restricted page found in hierarchy, access is allowed (falls back to space permissions)
      if (!pageData.restrictedPageId) {
        return {
          hasAccess: true,
          isRestricted: false,
        };
      }

      // Collect all permissions from the result
      const permissions = result
        .filter((r) => r.role && r.source)
        .map((r) => ({
          role: r.role,
          source: r.source as 'direct' | 'group',
          groupId: r.groupId || undefined,
          cascade: r.cascade || false,
        }));

      // If page is restricted but user has no permissions
      if (permissions.length === 0) {
        const isInheritedPermission = pageData.restrictedPageId !== opts.pageId;
        return {
          hasAccess: false,
          isRestricted: true,
          isInherited: isInheritedPermission,
          restrictedPageId: pageData.restrictedPageId,
          restrictedPageTitle: pageData.restrictedPageTitle,
          inheritedFrom: isInheritedPermission ? pageData.restrictedPageId : undefined,
        };
      }

      // Check for explicit denial (NONE role)
      const hasDenial = permissions.some((p) => p.role === PageMemberRole.NONE);
      if (hasDenial) {
        const isInheritedPermission = pageData.restrictedPageId !== opts.pageId;
        return {
          hasAccess: false,
          role: PageMemberRole.NONE,
          isRestricted: true,
          isInherited: isInheritedPermission,
          restrictedPageId: pageData.restrictedPageId,
          restrictedPageTitle: pageData.restrictedPageTitle,
          inheritedFrom: isInheritedPermission ? pageData.restrictedPageId : undefined,
          permissions,
        };
      }

      // Find highest role
      const highestRole = this.findHighestRoleFromStrings(
        permissions.map((p) => p.role),
      );

      // Check if permission cascades to child pages
      const canCascade = result.some((r) => r.cascade === true);
      const isInheritedPermission = pageData.restrictedPageId !== opts.pageId;

      // Access is granted if:
      // 1. Page itself is restricted and user has permission, OR
      // 2. Ancestor is restricted, user has permission, AND cascade is enabled
      return {
        hasAccess: !isInheritedPermission || canCascade,
        role: highestRole,
        isRestricted: true,
        isInherited: isInheritedPermission,
        restrictedPageId: pageData.restrictedPageId,
        restrictedPageTitle: pageData.restrictedPageTitle,
        inheritedFrom: isInheritedPermission
          ? pageData.restrictedPageId
          : undefined,
        permissions,
      };
    } catch (error) {
      // Log error for monitoring but don't expose internal details
      console.error('Error checking page permissions:', error);
      // Fail closed for security - deny access on error
      return {
        hasAccess: false,
        isRestricted: false,
      };
    }


  }

  async getUserPagePermissionAlternative(opts: {
    pageId: string;
    userId: string;
  }): Promise<{
    hasAccess: boolean;
    role?: string;
    restrictedPageId?: string;
    restrictedPageTitle?: string;
    isRestricted: boolean;
    inheritedFrom?: string;
    permissions?: Array<{
      role: string;
      source: 'direct' | 'group';
      groupId?: string;
    }>;
  }> {
    // Solution 2: Step-by-step approach with clearer logic flow
    // This approach trades some performance for improved maintainability and debuggability

    // Step 1: Build the page hierarchy from target page to root
    const pageHierarchy = await this.db
      .withRecursive('page_tree', (qb) =>
        qb
          .selectFrom('pages')
          .select([
            'id',
            'parentPageId',
            'title',
            'isRestricted',
            'restrictedById',
          ])
          .where('id', '=', opts.pageId)
          .where('deletedAt', 'is', null)
          .unionAll((eb) =>
            eb
              .selectFrom('pages as p')
              .innerJoin('page_tree as pt', 'p.id', 'pt.parentPageId')
              .select([
                'p.id',
                'p.parentPageId',
                'p.title',
                'p.isRestricted',
                'p.restrictedById',
              ])
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('page_tree')
      .selectAll()
      .execute();

    if (!pageHierarchy || pageHierarchy.length === 0) {
      return {
        hasAccess: false,
        isRestricted: false,
      };
    }

    // Step 2: Find the closest restricted page (starting from target, moving up)
    const targetPage = pageHierarchy.find((p) => p.id === opts.pageId);
    let restrictedPage = null;

    // Build ordered ancestor chain
    const ancestorChain: typeof pageHierarchy = [];
    let currentPage = targetPage;

    while (currentPage) {
      ancestorChain.push(currentPage);
      if (currentPage.isRestricted && !restrictedPage) {
        restrictedPage = currentPage;
      }
      currentPage = pageHierarchy.find(
        (p) => p.id === currentPage.parentPageId,
      );
    }

    // Step 3: If no restriction found, grant access (falls back to space permissions)
    if (!restrictedPage) {
      return {
        hasAccess: true,
        isRestricted: false,
      };
    }

    // Step 4: Get user's groups for permission checking
    const userGroups = await this.db
      .selectFrom('groupUsers')
      .select('groupId')
      .where('userId', '=', opts.userId)
      .execute();

    const userGroupIds = userGroups.map((g) => g.groupId);

    // Step 5: Fetch all permissions for the restricted page
    const pagePermissions = await this.db
      .selectFrom('pagePermissions')
      .leftJoin('groups', 'groups.id', 'pagePermissions.groupId')
      .selectAll('pagePermissions')
      .select(['groups.name as groupName'])
      .where('pagePermissions.pageId', '=', restrictedPage.id)
      .where('pagePermissions.deletedAt', 'is', null)
      .where((eb) =>
        eb.or([
          eb('pagePermissions.userId', '=', opts.userId),
          ...(userGroupIds.length > 0
            ? [eb('pagePermissions.groupId', 'in', userGroupIds)]
            : []),
        ]),
      )
      .execute();

    // Step 6: Process permissions
    const permissions = pagePermissions.map((p) => ({
      role: p.role,
      source:
        p.userId === opts.userId ? 'direct' : ('group' as 'direct' | 'group'),
      groupId: p.groupId || undefined,
      cascade: p.cascade,
    }));

    // Step 7: Check for access denial
    if (permissions.length === 0) {
      return {
        hasAccess: false,
        isRestricted: true,
        restrictedPageId: restrictedPage.id,
        restrictedPageTitle: restrictedPage.title,
      };
    }

    // Check for explicit NONE role
    const hasDenial = permissions.some((p) => p.role === PageMemberRole.NONE);
    if (hasDenial) {
      return {
        hasAccess: false,
        role: PageMemberRole.NONE,
        isRestricted: true,
        restrictedPageId: restrictedPage.id,
        restrictedPageTitle: restrictedPage.title,
        permissions: permissions.map((p) => ({
          role: p.role,
          source: p.source,
          groupId: p.groupId,
        })),
      };
    }

    // Step 8: Determine access based on cascade setting
    const highestRole = this.findHighestRoleFromStrings(
      permissions.map((p) => p.role),
    );
    const isInheritedPermission = restrictedPage.id !== opts.pageId;

    // Check if any permission allows cascading to children
    const canAccessChildPages = permissions.some((p) => p.cascade === true);

    // If restriction is on an ancestor page, check cascade
    if (isInheritedPermission && !canAccessChildPages) {
      return {
        hasAccess: false,
        role: highestRole,
        isRestricted: true,
        restrictedPageId: restrictedPage.id,
        restrictedPageTitle: restrictedPage.title,
        inheritedFrom: restrictedPage.id,
        permissions: permissions.map((p) => ({
          role: p.role,
          source: p.source,
          groupId: p.groupId,
        })),
      };
    }

    // Step 9: Grant access with the highest role
    return {
      hasAccess: true,
      role: highestRole,
      isRestricted: true,
      restrictedPageId: restrictedPage.id,
      restrictedPageTitle: restrictedPage.title,
      inheritedFrom: isInheritedPermission ? restrictedPage.id : undefined,
      permissions: permissions.map((p) => ({
        role: p.role,
        source: p.source,
        groupId: p.groupId,
      })),
    };
  }

  async getUserPagePermissionOld(opts: {
    pageId: string;
    userId: string;
  }): Promise<PagePermission> {
    // TODO: to
    // first we have to check if the page is restricted and by whom
    // we have to check both the page and all its ancestors if they have the is_restricted permission.
    //  if the page is not restricted directly or by its ancestors, we return access to the page and fall back to the space level permission.

    //If the page inherits permission from an ancestor,
    // we have to get the id and info of that ancestor.
    //then we want the code below, check if the userId, has access to that permissioned pageId, either directly or via a group.
    // then we return all the permissions, so we can select the highest role to grant the user access with in js
    // if not, then we return faled access. they dont have access

    // Single optimized query that traverses the page hierarchy and returns ALL permissions at the closest level
    // This handles cases where user has multiple permissions (direct + multiple groups)
    // Uses window function to find minimum level, then filters to only return permissions at that level

    const permissions = await this.db
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
      .with('user_permissions', (qb) =>
        qb
          .selectFrom('page_hierarchy as ph')
          .innerJoin('pagePermissions as pp', 'pp.pageId', 'ph.pageId')
          .leftJoin('groupUsers as gu', (join) =>
            join
              .onRef('gu.groupId', '=', 'pp.groupId')
              .on('gu.userId', '=', opts.userId),
          )
          .selectAll('pp')
          .select([
            'ph.level',
            sql<number>`MIN(ph.level) OVER ()`.as('min_level'),
          ])
          .where('pp.deletedAt', 'is', null)
          .where((eb) =>
            eb.or([
              eb('pp.userId', '=', opts.userId),
              eb('gu.userId', '=', opts.userId),
            ]),
          ),
      )
      .selectFrom('user_permissions')
      .selectAll()
      .where((eb) => eb('level', '=', eb.ref('min_level')))
      .execute();

    console.log(permissions);

    return permissions[0];
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
