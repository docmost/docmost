import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertablePageAccess,
  InsertablePagePermission,
  PageAccess,
  PagePermission,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { ExpressionBuilder, sql, SqlBool } from 'kysely';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { DB } from '@docmost/db/types/db';
import {
  CursorPaginationResult,
  executeWithCursorPagination,
} from '@docmost/db/pagination/cursor-pagination';
import { PagePermissionMember } from './types/page-permission.types';

export { PagePermissionMember } from './types/page-permission.types';

@Injectable()
export class PagePermissionRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly groupRepo: GroupRepo,
  ) {}

  async findPageAccessByPageId(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<PageAccess | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('pageAccess')
      .selectAll()
      .where('pageId', '=', pageId)
      .executeTakeFirst();
  }

  async insertPageAccess(
    data: InsertablePageAccess,
    trx?: KyselyTransaction,
  ): Promise<PageAccess> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pageAccess')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async deletePageAccess(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('pageAccess').where('pageId', '=', pageId).execute();
  }

  async insertPagePermissions(
    permissions: InsertablePagePermission[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (permissions.length === 0) return;
    const db = dbOrTx(this.db, trx);
    await db.insertInto('pagePermissions').values(permissions).execute();
  }

  async findPagePermissionByUserId(
    pageAccessId: string,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<PagePermission | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('pagePermissions')
      .selectAll()
      .where('pageAccessId', '=', pageAccessId)
      .where('userId', '=', userId)
      .executeTakeFirst();
  }

  async findPagePermissionByGroupId(
    pageAccessId: string,
    groupId: string,
    trx?: KyselyTransaction,
  ): Promise<PagePermission | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('pagePermissions')
      .selectAll()
      .where('pageAccessId', '=', pageAccessId)
      .where('groupId', '=', groupId)
      .executeTakeFirst();
  }

  async deletePagePermissionByUserId(
    pageAccessId: string,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pagePermissions')
      .where('pageAccessId', '=', pageAccessId)
      .where('userId', '=', userId)
      .execute();
  }

  async deletePagePermissionByGroupId(
    pageAccessId: string,
    groupId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pagePermissions')
      .where('pageAccessId', '=', pageAccessId)
      .where('groupId', '=', groupId)
      .execute();
  }

  async deletePagePermissionsByUserIds(
    pageAccessId: string,
    userIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (userIds.length === 0) return;
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pagePermissions')
      .where('pageAccessId', '=', pageAccessId)
      .where('userId', 'in', userIds)
      .execute();
  }

  async deletePagePermissionsByGroupIds(
    pageAccessId: string,
    groupIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (groupIds.length === 0) return;
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pagePermissions')
      .where('pageAccessId', '=', pageAccessId)
      .where('groupId', 'in', groupIds)
      .execute();
  }

  async updatePagePermissionRole(
    pageAccessId: string,
    role: string,
    opts: { userId?: string; groupId?: string },
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    let query = db
      .updateTable('pagePermissions')
      .set({ role, updatedAt: new Date() })
      .where('pageAccessId', '=', pageAccessId);

    if (opts.userId) {
      query = query.where('userId', '=', opts.userId);
    } else if (opts.groupId) {
      query = query.where('groupId', '=', opts.groupId);
    }

    await query.execute();
  }

  async countWritersByPageAccessId(
    pageAccessId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<number> {
    const db = dbOrTx(this.db, opts?.trx);
    const result = await db
      .selectFrom('pagePermissions')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('pageAccessId', '=', pageAccessId)
      .where('role', '=', 'writer')
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async getPagePermissionsPaginated(
    pageAccessId: string,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<PagePermissionMember>> {
    let baseQuery = this.db
      .selectFrom('pagePermissions')
      .leftJoin('users', 'users.id', 'pagePermissions.userId')
      .leftJoin('groups', 'groups.id', 'pagePermissions.groupId')
      .select([
        'pagePermissions.id',
        'pagePermissions.role',
        'pagePermissions.createdAt',
        'users.id as userId',
        'users.name as userName',
        'users.avatarUrl as userAvatarUrl',
        'users.email as userEmail',
        'groups.id as groupId',
        'groups.name as groupName',
        'groups.isDefault as groupIsDefault',
      ])
      .select((eb) => this.groupRepo.withMemberCount(eb))
      .select((eb) =>
        eb
          .case()
          .when('groups.id', 'is not', null)
          .then(1)
          .else(0)
          .end()
          .as('isGroup'),
      )
      .where('pageAccessId', '=', pageAccessId);

    if (pagination.query) {
      baseQuery = baseQuery.where((eb) =>
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

    const query = this.db.selectFrom(baseQuery.as('sub')).selectAll('sub');
    const result = await executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'sub.isGroup', direction: 'desc', key: 'isGroup' },
        { expression: 'sub.id', direction: 'asc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        isGroup: parseInt(cursor.isGroup, 10),
        id: cursor.id,
      }),
    });

    const items: PagePermissionMember[] = result.items.map((member) => {
      if (member.userId) {
        return {
          id: member.userId,
          name: member.userName,
          email: member.userEmail,
          avatarUrl: member.userAvatarUrl,
          type: 'user' as const,
          role: member.role,
          createdAt: member.createdAt,
        };
      } else {
        return {
          id: member.groupId,
          name: member.groupName,
          memberCount: member.memberCount as number,
          isDefault: member.groupIsDefault,
          type: 'group' as const,
          role: member.role,
          createdAt: member.createdAt,
        };
      }
    });

    return { items, meta: result.meta };
  }

  async getUserPagePermission(
    userId: string,
    pageId: string,
  ): Promise<{ role: string } | undefined> {
    const result = await this.db
      .selectFrom('pageAccess')
      .innerJoin(
        'pagePermissions',
        'pagePermissions.pageAccessId',
        'pageAccess.id',
      )
      .select(['pagePermissions.role'])
      .where('pageAccess.pageId', '=', pageId)
      .where('pagePermissions.userId', '=', userId)
      .unionAll(
        this.db
          .selectFrom('pageAccess')
          .innerJoin(
            'pagePermissions',
            'pagePermissions.pageAccessId',
            'pageAccess.id',
          )
          .innerJoin(
            'groupUsers',
            'groupUsers.groupId',
            'pagePermissions.groupId',
          )
          .select(['pagePermissions.role'])
          .where('pageAccess.pageId', '=', pageId)
          .where('groupUsers.userId', '=', userId),
      )
      .executeTakeFirst();

    return result;
  }

  async findRestrictedAncestor(pageId: string): Promise<
    | {
        pageAccessId: string;
        pageId: string;
        accessLevel: string;
        depth: number;
      }
    | undefined
  > {
    return this.db
      .withRecursive('ancestors', (qb) =>
        qb
          .selectFrom('pages')
          .select([
            'pages.id as ancestorId',
            'pages.parentPageId',
            sql<number>`0`.as('depth'),
          ])
          .where('pages.id', '=', pageId)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
              .select([
                'pages.id as ancestorId',
                'pages.parentPageId',
                sql<number>`ancestors.depth + 1`.as('depth'),
              ]),
          ),
      )
      .selectFrom('ancestors')
      .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
      .select([
        'pageAccess.id as pageAccessId',
        'pageAccess.pageId',
        'pageAccess.accessLevel',
        'ancestors.depth',
      ])
      .orderBy('ancestors.depth', 'asc')
      .executeTakeFirst();
  }

  /**
   * Check if user can access a page by verifying they have permission on ALL restricted ancestors.
   */
  async canUserAccessPage(userId: string, pageId: string): Promise<boolean> {
    const deniedAncestor = await this.db
      .withRecursive('ancestors', (qb) =>
        qb
          .selectFrom('pages')
          .select(['pages.id as ancestorId', 'pages.parentPageId'])
          .where('pages.id', '=', pageId)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
              .select(['pages.id as ancestorId', 'pages.parentPageId']),
          ),
      )
      .selectFrom('ancestors')
      .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
      .leftJoin('pagePermissions', (join) =>
        join
          .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
          .on((eb) =>
            eb.or([
              eb('pagePermissions.userId', '=', userId),
              eb(
                'pagePermissions.groupId',
                'in',
                this.userGroupIdsSubquery(eb, userId),
              ),
            ]),
          ),
      )
      .select('pageAccess.pageId')
      .where('pagePermissions.id', 'is', null)
      .executeTakeFirst();

    return !deniedAncestor;
  }

  /**
   * Check if user can edit a page.
   * Single query: builds ancestor chain once, checks both traversal and nearest-restricted writer.
   * - bool_and(pp.id IS NOT NULL): false if any restricted ancestor has no permission (traversal denied)
   * - array_agg(role ORDER BY depth)[1]: role on the nearest restricted ancestor
   * - Zero rows (no restricted ancestors): both NULL → defer to space permissions (true)
   */
  async canUserEditPage(
    userId: string,
    pageId: string,
  ): Promise<{
    hasAnyRestriction: boolean;
    canAccess: boolean;
    canEdit: boolean;
  }> {
    const result = await sql<{
      canAccess: boolean | null;
      canEdit: boolean | null;
    }>`
      WITH RECURSIVE ancestors AS (
        SELECT id AS ancestor_id, parent_page_id, 0 AS depth
        FROM pages
        WHERE id = ${pageId}::uuid
        UNION ALL
        SELECT p.id, p.parent_page_id, a.depth + 1
        FROM pages p
        JOIN ancestors a ON a.parent_page_id = p.id
      )
      SELECT
        bool_and(pp.id IS NOT NULL) AS "canAccess",
        -- nearest restricted ancestor's highest role wins (DESC: 'writer' > 'reader', NULLS LAST: no-permission after real roles)
        (array_agg(pp.role ORDER BY a.depth ASC, pp.role DESC NULLS LAST))[1] = 'writer' AS "canEdit"
      FROM ancestors a
      JOIN page_access pa ON pa.page_id = a.ancestor_id
      LEFT JOIN page_permissions pp ON pp.page_access_id = pa.id
        AND (
          pp.user_id = ${userId}::uuid
          OR pp.group_id IN (
            SELECT gu.group_id FROM group_users gu WHERE gu.user_id = ${userId}::uuid
          )
        )
    `.execute(this.db);

    const row = result.rows[0];
    if (!row || row.canAccess === null) {
      return { hasAnyRestriction: false, canAccess: true, canEdit: true };
    }
    return {
      hasAnyRestriction: true,
      canAccess: row.canAccess,
      canEdit: row.canAccess && (row.canEdit ?? false),
    };
  }

  /**
   * Get user's access level for a page.
   * Returns:
   * - hasDirectRestriction: whether this specific page has restrictions
   * - hasInheritedRestriction: whether any ancestor (not self) has restrictions
   * - hasAnyRestriction: hasDirectRestriction || hasInheritedRestriction
   * - canAccess: user has permission on all restricted ancestors (always true if no restrictions)
   * - canEdit: user has writer on nearest restricted ancestor (always true if no restrictions)
   */
  async getUserPageAccessLevel(
    userId: string,
    pageId: string,
  ): Promise<{
    hasDirectRestriction: boolean;
    hasInheritedRestriction: boolean;
    hasAnyRestriction: boolean;
    canAccess: boolean;
    canEdit: boolean;
  }> {
    const result = await this.db
      .withRecursive('ancestors', (qb) =>
        qb
          .selectFrom('pages')
          .select([
            'pages.id as ancestorId',
            'pages.parentPageId',
            sql<number>`0`.as('depth'),
          ])
          .where('pages.id', '=', pageId)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
              .select([
                'pages.id as ancestorId',
                'pages.parentPageId',
                sql<number>`ancestors.depth + 1`.as('depth'),
              ]),
          ),
      )
      .selectFrom('pages')
      .select((eb) => [
        // hasDirectRestriction: this page itself has page_access entry
        eb
          .case()
          .when(
            eb.exists(
              eb
                .selectFrom('pageAccess')
                .select('pageAccess.id')
                .whereRef('pageAccess.pageId', '=', 'pages.id'),
            ),
          )
          .then(true)
          .else(false)
          .end()
          .as('hasDirectRestriction'),
        // hasInheritedRestriction: any ancestor (depth > 0) has page_access entry
        eb
          .case()
          .when(
            eb.exists(
              eb
                .selectFrom('ancestors')
                .innerJoin(
                  'pageAccess',
                  'pageAccess.pageId',
                  'ancestors.ancestorId',
                )
                .select('pageAccess.id')
                .where('ancestors.depth', '>', 0),
            ),
          )
          .then(true)
          .else(false)
          .end()
          .as('hasInheritedRestriction'),
        // canAccess: no restricted ancestor without ANY permission
        eb
          .case()
          .when(
            eb.not(
              eb.exists(
                eb
                  .selectFrom('ancestors')
                  .innerJoin(
                    'pageAccess',
                    'pageAccess.pageId',
                    'ancestors.ancestorId',
                  )
                  .leftJoin('pagePermissions', (join) =>
                    join
                      .onRef(
                        'pagePermissions.pageAccessId',
                        '=',
                        'pageAccess.id',
                      )
                      .on((eb2) =>
                        eb2.or([
                          eb2('pagePermissions.userId', '=', userId),
                          eb2(
                            'pagePermissions.groupId',
                            'in',
                            this.userGroupIdsSubquery(eb2, userId),
                          ),
                        ]),
                      ),
                  )
                  .select('pageAccess.pageId')
                  .where('pagePermissions.id', 'is', null),
              ),
            ),
          )
          .then(true)
          .else(false)
          .end()
          .as('canAccess'),
        // canEdit: nearest restricted ancestor determines edit capability
        eb
          .case()
          // traversal denied: any restricted ancestor without any permission
          .when(
            eb.exists(
              eb
                .selectFrom('ancestors')
                .innerJoin(
                  'pageAccess',
                  'pageAccess.pageId',
                  'ancestors.ancestorId',
                )
                .leftJoin('pagePermissions', (join) =>
                  join
                    .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
                    .on((eb2) =>
                      eb2.or([
                        eb2('pagePermissions.userId', '=', userId),
                        eb2(
                          'pagePermissions.groupId',
                          'in',
                          this.userGroupIdsSubquery(eb2, userId),
                        ),
                      ]),
                    ),
                )
                .select('pageAccess.pageId')
                .where('pagePermissions.id', 'is', null),
            ),
          )
          .then(false)
          // no restricted ancestors at all → defer to space permissions
          .when(
            eb.not(
              eb.exists(
                eb
                  .selectFrom('ancestors')
                  .innerJoin(
                    'pageAccess',
                    'pageAccess.pageId',
                    'ancestors.ancestorId',
                  )
                  .select('pageAccess.id'),
              ),
            ),
          )
          .then(true)
          // nearest restricted ancestor has writer for this user
          .when(
            eb.exists(
              eb
                .selectFrom('pagePermissions')
                .select('pagePermissions.id')
                .where('pagePermissions.role', '=', 'writer')
                .where(
                  'pagePermissions.pageAccessId',
                  '=',
                  sql<string>`(
                    SELECT pa.id FROM ancestors a_nr
                    JOIN page_access pa ON pa.page_id = a_nr.ancestor_id
                    ORDER BY a_nr.depth ASC
                    LIMIT 1
                  )`,
                )
                .where((eb2) =>
                  eb2.or([
                    eb2('pagePermissions.userId', '=', userId),
                    eb2(
                      'pagePermissions.groupId',
                      'in',
                      this.userGroupIdsSubquery(eb2, userId),
                    ),
                  ]),
                ),
            ),
          )
          .then(true)
          .else(false)
          .end()
          .as('canEdit'),
      ])
      .where('pages.id', '=', pageId)
      .executeTakeFirst();

    const hasDirectRestriction = Boolean(result?.hasDirectRestriction);
    const hasInheritedRestriction = Boolean(result?.hasInheritedRestriction);

    return {
      hasDirectRestriction,
      hasInheritedRestriction,
      hasAnyRestriction: hasDirectRestriction || hasInheritedRestriction,
      canAccess: Boolean(result?.canAccess),
      canEdit: Boolean(result?.canEdit),
    };
  }

  /**
   * Filter a list of page IDs to only those the user can access.
   * Returns page IDs with their permission level (canEdit).
   * Single query implementation for efficiency.
   */
  async filterAccessiblePageIds(opts: {
    pageIds: string[];
    userId: string;
    spaceId?: string;
  }): Promise<string[]> {
    const { pageIds, userId, spaceId } = opts;
    if (pageIds.length === 0) return [];

    if (spaceId) {
      const hasRestrictions = await this.hasRestrictedPagesInSpace(spaceId);
      if (!hasRestrictions) {
        return pageIds;
      }
    }

    const results = await this.db
      .withRecursive('allAncestors', (qb) =>
        qb
          .selectFrom('pages')
          .select([
            'pages.id as pageId',
            'pages.id as ancestorId',
            'pages.parentPageId',
          ])
          .where(sql<SqlBool>`pages.id = ANY(${pageIds}::uuid[])`)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin(
                'allAncestors',
                'allAncestors.parentPageId',
                'pages.id',
              )
              .select([
                'allAncestors.pageId',
                'pages.id as ancestorId',
                'pages.parentPageId',
              ]),
          ),
      )
      .selectFrom('pages')
      .select('pages.id')
      .where(sql<SqlBool>`pages.id = ANY(${pageIds}::uuid[])`)
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('allAncestors')
              .innerJoin(
                'pageAccess',
                'pageAccess.pageId',
                'allAncestors.ancestorId',
              )
              .leftJoin('pagePermissions', (join) =>
                join
                  .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
                  .on((eb) =>
                    eb.or([
                      eb('pagePermissions.userId', '=', userId),
                      eb(
                        'pagePermissions.groupId',
                        'in',
                        this.userGroupIdsSubquery(eb, userId),
                      ),
                    ]),
                  ),
              )
              .select('pageAccess.pageId')
              .whereRef('allAncestors.pageId', '=', 'pages.id')
              .where('pagePermissions.id', 'is', null),
          ),
        ),
      )
      .execute();

    return results.map((r) => r.id);
  }

  async filterAccessiblePageIdsWithPermissions(
    pageIds: string[],
    userId: string,
  ): Promise<Array<{ id: string; canEdit: boolean }>> {
    if (pageIds.length === 0) return [];

    const results = await this.db
      .withRecursive('allAncestors', (qb) =>
        qb
          .selectFrom('pages')
          .select([
            'pages.id as pageId',
            'pages.id as ancestorId',
            'pages.parentPageId',
            sql<number>`0`.as('depth'),
          ])
          .where(sql<SqlBool>`pages.id = ANY(${pageIds}::uuid[])`)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin(
                'allAncestors',
                'allAncestors.parentPageId',
                'pages.id',
              )
              .select([
                'allAncestors.pageId',
                'pages.id as ancestorId',
                'pages.parentPageId',
                sql<number>`all_ancestors.depth + 1`.as('depth'),
              ]),
          ),
      )
      .selectFrom('pages')
      .select('pages.id')
      .select((eb) =>
        eb
          .case()
          // no restricted ancestors for this page → defer to space
          .when(
            eb.not(
              eb.exists(
                eb
                  .selectFrom('allAncestors')
                  .innerJoin(
                    'pageAccess',
                    'pageAccess.pageId',
                    'allAncestors.ancestorId',
                  )
                  .select('pageAccess.id')
                  .whereRef('allAncestors.pageId', '=', 'pages.id'),
              ),
            ),
          )
          .then(true)
          // nearest restricted ancestor has writer for this user
          .when(
            eb.exists(
              eb
                .selectFrom('pagePermissions')
                .select('pagePermissions.id')
                .where('pagePermissions.role', '=', 'writer')
                .where(
                  'pagePermissions.pageAccessId',
                  '=',
                  sql<string>`(
                    SELECT pa.id FROM all_ancestors aa
                    JOIN page_access pa ON pa.page_id = aa.ancestor_id
                    WHERE aa.page_id = pages.id
                    ORDER BY aa.depth ASC
                    LIMIT 1
                  )`,
                )
                .where((eb2) =>
                  eb2.or([
                    eb2('pagePermissions.userId', '=', userId),
                    eb2(
                      'pagePermissions.groupId',
                      'in',
                      this.userGroupIdsSubquery(eb2, userId),
                    ),
                  ]),
                ),
            ),
          )
          .then(true)
          .else(false)
          .end()
          .as('canEdit'),
      )
      .where(sql<SqlBool>`pages.id = ANY(${pageIds}::uuid[])`)
      // view filter: no restricted ancestor without any permission
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('allAncestors')
              .innerJoin(
                'pageAccess',
                'pageAccess.pageId',
                'allAncestors.ancestorId',
              )
              .leftJoin('pagePermissions', (join) =>
                join
                  .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
                  .on((eb) =>
                    eb.or([
                      eb('pagePermissions.userId', '=', userId),
                      eb(
                        'pagePermissions.groupId',
                        'in',
                        this.userGroupIdsSubquery(eb, userId),
                      ),
                    ]),
                  ),
              )
              .select('pageAccess.pageId')
              .whereRef('allAncestors.pageId', '=', 'pages.id')
              .where('pagePermissions.id', 'is', null),
          ),
        ),
      )
      .execute();

    return results.map((r) => ({ id: r.id, canEdit: Boolean(r.canEdit) }));
  }

  /**
   * Check if a page or any of its ancestors has restrictions.
   * Used to determine if page-level permission checks are needed.
   */
  async hasRestrictedAncestor(pageId: string): Promise<boolean> {
    const result = await this.db
      .withRecursive('ancestors', (qb) =>
        qb
          .selectFrom('pages')
          .select(['pages.id as ancestorId', 'pages.parentPageId'])
          .where('pages.id', '=', pageId)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
              .select(['pages.id as ancestorId', 'pages.parentPageId']),
          ),
      )
      .selectFrom('ancestors')
      .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
      .select('pageAccess.id')
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Check if any page in a space has restrictions.
   * Used as a quick check to skip heavy permission filtering when no restrictions exist.
   */
  async hasRestrictedPagesInSpace(spaceId: string): Promise<boolean> {
    const result = await this.db
      .selectNoFrom((eb) =>
        eb
          .exists(
            eb
              .selectFrom('pageAccess')
              .select(sql`1`.as('one'))
              .where('pageAccess.spaceId', '=', spaceId),
          )
          .as('exists'),
      )
      .executeTakeFirst();

    return Boolean(result?.exists);
  }

  /**
   * Given a list of parent page IDs, return which ones have at least one accessible child.
   * Efficient batch query for sidebar hasChildren calculation.
   */
  async getParentIdsWithAccessibleChildren(
    parentIds: string[],
    userId: string,
  ): Promise<string[]> {
    if (parentIds.length === 0) return [];

    const results = await this.db
      .withRecursive('childAncestors', (qb) =>
        qb
          .selectFrom('pages as child')
          .select([
            'child.id as childId',
            'child.id as ancestorId',
            'child.parentPageId as ancestorParentId',
          ])
          .where('child.parentPageId', 'in', parentIds)
          .where('child.deletedAt', 'is', null)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin(
                'childAncestors',
                'childAncestors.ancestorParentId',
                'pages.id',
              )
              .select([
                'childAncestors.childId',
                'pages.id as ancestorId',
                'pages.parentPageId as ancestorParentId',
              ]),
          ),
      )
      .selectFrom('pages as child')
      .select('child.parentPageId')
      .distinct()
      .where('child.parentPageId', 'in', parentIds)
      .where('child.deletedAt', 'is', null)
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('childAncestors')
              .innerJoin(
                'pageAccess',
                'pageAccess.pageId',
                'childAncestors.ancestorId',
              )
              .leftJoin('pagePermissions', (join) =>
                join
                  .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
                  .on((eb) =>
                    eb.or([
                      eb('pagePermissions.userId', '=', userId),
                      eb(
                        'pagePermissions.groupId',
                        'in',
                        this.userGroupIdsSubquery(eb, userId),
                      ),
                    ]),
                  ),
              )
              .select('pageAccess.pageId')
              .whereRef('childAncestors.childId', '=', 'child.id')
              .where('pagePermissions.id', 'is', null),
          ),
        ),
      )
      .execute();

    return results.map((r) => r.parentPageId);
  }

  /**
   * Get all page IDs within a subtree that are restricted OR are descendants of restricted pages.
   * Used to filter pages from public shares - if a page is restricted, it and all its
   * children should be hidden.
   */
  async getRestrictedSubtreeIds(rootPageId: string): Promise<string[]> {
    const results = await this.db
      .withRecursive('descendants', (qb) =>
        qb
          .selectFrom('pages')
          .select(['pages.id as descendantId', 'pages.parentPageId'])
          .where('pages.id', '=', rootPageId)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin(
                'descendants',
                'descendants.descendantId',
                'pages.parentPageId',
              )
              .select(['pages.id as descendantId', 'pages.parentPageId'])
              .where('pages.deletedAt', 'is', null),
          ),
      )
      .withRecursive('descendantAncestors', (qb) =>
        qb
          .selectFrom('descendants')
          .innerJoin('pages', 'pages.id', 'descendants.descendantId')
          .select([
            'descendants.descendantId',
            'pages.id as ancestorId',
            'pages.parentPageId as ancestorParentId',
          ])
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin(
                'descendantAncestors',
                'descendantAncestors.ancestorParentId',
                'pages.id',
              )
              .select([
                'descendantAncestors.descendantId',
                'pages.id as ancestorId',
                'pages.parentPageId as ancestorParentId',
              ]),
          ),
      )
      .selectFrom('descendantAncestors')
      .innerJoin(
        'pageAccess',
        'pageAccess.pageId',
        'descendantAncestors.ancestorId',
      )
      .select('descendantAncestors.descendantId')
      .distinct()
      .execute();

    return results.map((r) => r.descendantId);
  }

  /**
   * Given a pageId and a set of candidate userIds, return the subset who can
   * access the page (have permission on ALL restricted ancestors).
   * Returns all userIds if the page has no restricted ancestors.
   */
  async getUserIdsWithPageAccess(
    pageId: string,
    userIds: string[],
  ): Promise<string[]> {
    if (userIds.length === 0) return [];

    const results = await sql<{ userId: string }>`
      WITH RECURSIVE ancestors AS (
        SELECT id AS ancestor_id, parent_page_id
        FROM pages
        WHERE id = ${pageId}::uuid
        UNION ALL
        SELECT p.id, p.parent_page_id
        FROM pages p
        JOIN ancestors a ON a.parent_page_id = p.id
      )
      SELECT cu.user_id AS "userId"
      FROM unnest(${userIds}::uuid[]) AS cu(user_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM ancestors a
        JOIN page_access pa ON pa.page_id = a.ancestor_id
        LEFT JOIN page_permissions pp ON pp.page_access_id = pa.id
          AND (
            pp.user_id = cu.user_id
            OR pp.group_id IN (
              SELECT gu.group_id FROM group_users gu WHERE gu.user_id = cu.user_id
            )
          )
        WHERE pp.id IS NULL
      )
    `.execute(this.db);

    return results.rows.map((r) => r.userId);
  }

  private userGroupIdsSubquery(
    eb: ExpressionBuilder<any, keyof DB>,
    userId: string,
  ) {
    return eb
      .selectFrom('groupUsers')
      .select('groupUsers.groupId')
      .where('groupUsers.userId', '=', userId);
  }
}
