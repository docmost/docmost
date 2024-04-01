import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  GroupUser,
  InsertableGroupUser,
  User,
} from '@docmost/db/types/entity.types';
import { sql } from 'kysely';
import { PaginationOptions } from '../../pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';

@Injectable()
export class GroupUserRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async getGroupUserById(
    userId: string,
    groupId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('groupUsers')
      .selectAll()
      .where('userId', '=', userId)
      .where('groupId', '=', groupId)
      .executeTakeFirst();
  }

  async insertGroupUser(
    insertableGroupUser: InsertableGroupUser,
    trx?: KyselyTransaction,
  ): Promise<GroupUser> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('groupUsers')
      .values(insertableGroupUser)
      .returningAll()
      .executeTakeFirst();
  }

  async getGroupUsersPaginated(groupId: string, pagination: PaginationOptions) {
    let query = this.db
      .selectFrom('groupUsers')
      .innerJoin('users', 'users.id', 'groupUsers.userId')
      .select(sql<User>`users.*` as any)
      .where('groupId', '=', groupId)
      .orderBy('createdAt', 'asc');

    if (pagination.query) {
      query = query.where((eb) =>
        eb('users.name', 'ilike', `%${pagination.query}%`),
      );
    }

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    return result;
  }

  async delete(userId: string, groupId: string): Promise<void> {
    await this.db
      .deleteFrom('groupUsers')
      .where('userId', '=', userId)
      .where('groupId', '=', groupId)
      .execute();
  }
}
