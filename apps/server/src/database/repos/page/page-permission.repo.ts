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
}
