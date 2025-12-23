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
import { sql } from 'kysely';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';

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

  async deletePageAccess(pageId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('pageAccess').where('pageId', '=', pageId).execute();
  }

  async insertPagePermissions(
    permissions: InsertablePagePermission[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (permissions.length === 0) return;
    const db = dbOrTx(this.db, trx);
    await db
      .insertInto('pagePermissions')
      .values(permissions)
      .execute();
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
      .innerJoin('pagePermissions', 'pagePermissions.pageAccessId', 'pageAccess.id')
      .select(['pagePermissions.role'])
      .where('pageAccess.pageId', '=', pageId)
      .where('pagePermissions.userId', '=', userId)
      .unionAll(
        this.db
          .selectFrom('pageAccess')
          .innerJoin('pagePermissions', 'pagePermissions.pageAccessId', 'pageAccess.id')
          .innerJoin('groupUsers', 'groupUsers.groupId', 'pagePermissions.groupId')
          .select(['pagePermissions.role'])
          .where('pageAccess.pageId', '=', pageId)
          .where('groupUsers.userId', '=', userId),
      )
      .executeTakeFirst();

    return result;
  }

  async findRestrictedAncestor(
    pageId: string,
  ): Promise<{ pageId: string; accessLevel: string; depth: number } | undefined> {
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
   * Returns true if:
   * - No ancestors are restricted, OR
   * - User has permission (reader or writer) on every restricted ancestor
   */
  async canUserAccessPage(userId: string, pageId: string): Promise<boolean> {
    // Find any restricted ancestor where user lacks permission
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
   * Returns true if:
   * - No ancestors are restricted, OR
   * - User has writer permission on every restricted ancestor
   */
  async canUserEditPage(userId: string, pageId: string): Promise<boolean> {
    // Find any restricted ancestor where user lacks writer permission
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
   * Filter a list of page IDs to only those the user can access.
   * Efficient single-query implementation for bulk filtering.
   */
  async filterAccessiblePageIds(
    pageIds: string[],
    userId: string,
  ): Promise<string[]> {
    if (pageIds.length === 0) return [];

    // For each page, count restricted ancestors vs permitted ancestors
    // A page is accessible if restrictedCount == permittedCount
    const results = await this.db
      .selectFrom('pages')
      .select('pages.id')
      .where('pages.id', 'in', pageIds)
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

    return results.map((r) => r.id);
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
}
