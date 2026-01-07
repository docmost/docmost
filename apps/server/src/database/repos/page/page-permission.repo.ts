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
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { sql, SqlBool } from 'kysely';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';

@Injectable()
export class PagePermissionRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly groupRepo: GroupRepo,
    private readonly groupUserRepo: GroupUserRepo,
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
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);
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
  ) {
    let query = this.db
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
      .where('pageAccessId', '=', pageAccessId)
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

    const members = result.items.map((member) => {
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

    result.items = members as any;
    return result;
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

  async findRestrictedAncestor(
    pageId: string,
  ): Promise<
    { pageId: string; accessLevel: string; depth: number } | undefined
  > {
    return this.db
      .selectFrom('pageHierarchy')
      .innerJoin('pageAccess', 'pageAccess.pageId', 'pageHierarchy.ancestorId')
      .select([
        'pageAccess.pageId',
        'pageAccess.accessLevel',
        'pageHierarchy.depth',
      ])
      .where('pageHierarchy.descendantId', '=', pageId)
      .orderBy('pageHierarchy.depth', 'asc')
      .executeTakeFirst();
  }

  /**
   * Check if user can access a page by verifying they have permission on ALL restricted ancestors.
   */
  async canUserAccessPage(userId: string, pageId: string): Promise<boolean> {
    const deniedAncestor = await this.db
      .selectFrom('pageHierarchy')
      .innerJoin('pageAccess', 'pageAccess.pageId', 'pageHierarchy.ancestorId')
      .leftJoin('pagePermissions', (join) =>
        join
          .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
          .on((eb) =>
            eb.or([
              eb('pagePermissions.userId', '=', userId),
              eb(
                'pagePermissions.groupId',
                'in',
                eb
                  .selectFrom('groupUsers')
                  .select('groupUsers.groupId')
                  .where('groupUsers.userId', '=', userId),
              ),
            ]),
          ),
      )
      .select('pageAccess.pageId')
      .where('pageHierarchy.descendantId', '=', pageId)
      .where('pagePermissions.id', 'is', null)
      .executeTakeFirst();

    return !deniedAncestor;
  }

  /**
   * Check if user can edit a page by verifying they have WRITER permission on ALL restricted ancestors.
   */
  async canUserEditPage(userId: string, pageId: string): Promise<boolean> {
    const deniedAncestor = await this.db
      .selectFrom('pageHierarchy')
      .innerJoin('pageAccess', 'pageAccess.pageId', 'pageHierarchy.ancestorId')
      .leftJoin('pagePermissions', (join) =>
        join
          .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
          .on('pagePermissions.role', '=', 'writer')
          .on((eb) =>
            eb.or([
              eb('pagePermissions.userId', '=', userId),
              eb(
                'pagePermissions.groupId',
                'in',
                eb
                  .selectFrom('groupUsers')
                  .select('groupUsers.groupId')
                  .where('groupUsers.userId', '=', userId),
              ),
            ]),
          ),
      )
      .select('pageAccess.pageId')
      .where('pageHierarchy.descendantId', '=', pageId)
      .where('pagePermissions.id', 'is', null)
      .executeTakeFirst();

    return !deniedAncestor;
  }

  /**
   * Get user's access level for a page, checking ALL restricted ancestors.
   * Returns:
   * - hasDirectRestriction: whether this specific page has restrictions
   * - hasInheritedRestriction: whether any ancestor (not self) has restrictions
   * - hasAnyRestriction: hasDirectRestriction || hasInheritedRestriction
   * - canAccess: user has permission on all restricted ancestors (always true if no restrictions)
   * - canEdit: user has writer permission on all restricted ancestors (always true if no restrictions)
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
                .selectFrom('pageHierarchy')
                .innerJoin(
                  'pageAccess',
                  'pageAccess.pageId',
                  'pageHierarchy.ancestorId',
                )
                .select('pageAccess.id')
                .whereRef('pageHierarchy.descendantId', '=', 'pages.id')
                .where('pageHierarchy.depth', '>', 0),
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
                  .selectFrom('pageHierarchy')
                  .innerJoin(
                    'pageAccess',
                    'pageAccess.pageId',
                    'pageHierarchy.ancestorId',
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
                            eb2
                              .selectFrom('groupUsers')
                              .select('groupUsers.groupId')
                              .where('groupUsers.userId', '=', userId),
                          ),
                        ]),
                      ),
                  )
                  .select('pageAccess.pageId')
                  .whereRef('pageHierarchy.descendantId', '=', 'pages.id')
                  .where('pagePermissions.id', 'is', null),
              ),
            ),
          )
          .then(true)
          .else(false)
          .end()
          .as('canAccess'),
        // canEdit: no restricted ancestor without WRITER permission
        eb
          .case()
          .when(
            eb.not(
              eb.exists(
                eb
                  .selectFrom('pageHierarchy')
                  .innerJoin(
                    'pageAccess',
                    'pageAccess.pageId',
                    'pageHierarchy.ancestorId',
                  )
                  .leftJoin('pagePermissions', (join) =>
                    join
                      .onRef(
                        'pagePermissions.pageAccessId',
                        '=',
                        'pageAccess.id',
                      )
                      .on('pagePermissions.role', '=', 'writer')
                      .on((eb2) =>
                        eb2.or([
                          eb2('pagePermissions.userId', '=', userId),
                          eb2(
                            'pagePermissions.groupId',
                            'in',
                            eb2
                              .selectFrom('groupUsers')
                              .select('groupUsers.groupId')
                              .where('groupUsers.userId', '=', userId),
                          ),
                        ]),
                      ),
                  )
                  .select('pageAccess.pageId')
                  .whereRef('pageHierarchy.descendantId', '=', 'pages.id')
                  .where('pagePermissions.id', 'is', null),
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
  async filterAccessiblePageIdsWithPermissions(
    pageIds: string[],
    userId: string,
  ): Promise<Array<{ id: string; canEdit: boolean }>> {
    if (pageIds.length === 0) return [];

    const results = await this.db
      .selectFrom('pages')
      .select('pages.id')
      // Check if user lacks writer permission on any restricted ancestor
      .select((eb) =>
        eb
          .case()
          .when(
            eb.not(
              eb.exists(
                eb
                  .selectFrom('pageHierarchy')
                  .innerJoin(
                    'pageAccess',
                    'pageAccess.pageId',
                    'pageHierarchy.ancestorId',
                  )
                  .leftJoin('pagePermissions', (join) =>
                    join
                      .onRef(
                        'pagePermissions.pageAccessId',
                        '=',
                        'pageAccess.id',
                      )
                      .on('pagePermissions.role', '=', 'writer')
                      .on((eb2) =>
                        eb2.or([
                          eb2('pagePermissions.userId', '=', userId),
                          eb2(
                            'pagePermissions.groupId',
                            'in',
                            eb2
                              .selectFrom('groupUsers')
                              .select('groupUsers.groupId')
                              .where('groupUsers.userId', '=', userId),
                          ),
                        ]),
                      ),
                  )
                  .select('pageAccess.pageId')
                  .whereRef('pageHierarchy.descendantId', '=', 'pages.id')
                  .where('pagePermissions.id', 'is', null),
              ),
            ),
          )
          .then(true)
          .else(false)
          .end()
          .as('canEdit'),
      )
      .where(sql<SqlBool>`pages.id = ANY(${pageIds}::uuid[])`)
      // Filter: user must have access (any permission on all restricted ancestors)
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('pageHierarchy')
              .innerJoin(
                'pageAccess',
                'pageAccess.pageId',
                'pageHierarchy.ancestorId',
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
                        eb
                          .selectFrom('groupUsers')
                          .select('groupUsers.groupId')
                          .where('groupUsers.userId', '=', userId),
                      ),
                    ]),
                  ),
              )
              .select('pageAccess.pageId')
              .whereRef('pageHierarchy.descendantId', '=', 'pages.id')
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
      .selectFrom('pageHierarchy')
      .innerJoin('pageAccess', 'pageAccess.pageId', 'pageHierarchy.ancestorId')
      .select('pageAccess.id')
      .where('pageHierarchy.descendantId', '=', pageId)
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
              .innerJoin('pages', 'pages.id', 'pageAccess.pageId')
              .select(sql`1`.as('one'))
              .where('pages.spaceId', '=', spaceId),
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
      .selectFrom('pages as child')
      .select('child.parentPageId')
      .distinct()
      .where('child.parentPageId', 'in', parentIds)
      .where('child.deletedAt', 'is', null)
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('pageHierarchy')
              .innerJoin(
                'pageAccess',
                'pageAccess.pageId',
                'pageHierarchy.ancestorId',
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
                        eb
                          .selectFrom('groupUsers')
                          .select('groupUsers.groupId')
                          .where('groupUsers.userId', '=', userId),
                      ),
                    ]),
                  ),
              )
              .select('pageAccess.pageId')
              .whereRef('pageHierarchy.descendantId', '=', 'child.id')
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
      .selectFrom('pageHierarchy as subtree')
      .where('subtree.ancestorId', '=', rootPageId)
      .innerJoin(
        (eb) =>
          eb
            .selectFrom('pageHierarchy as inner')
            .innerJoin('pageAccess', 'pageAccess.pageId', 'inner.ancestorId')
            .select('inner.descendantId as restrictedDescendant')
            .distinct()
            .as('restricted'),
        (join) =>
          join.onRef(
            'restricted.restrictedDescendant',
            '=',
            'subtree.descendantId',
          ),
      )
      .select('subtree.descendantId')
      .distinct()
      .execute();

    return results.map((r) => r.descendantId);
  }
}
