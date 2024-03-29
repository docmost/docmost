import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import {
  GroupUser,
  InsertableGroupUser,
  User,
} from '@docmost/db/types/entity.types';
import { sql } from 'kysely';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';

@Injectable()
export class GroupUserRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async getGroupUserById(
    userId: string,
    groupId: string,
    trx?: KyselyTransaction,
  ) {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .selectFrom('group_users')
          .selectAll()
          .where('userId', '=', userId)
          .where('groupId', '=', groupId)
          .executeTakeFirst();
      },
      trx,
    );
  }

  async insertGroupUser(
    insertableGroupUser: InsertableGroupUser,
    trx?: KyselyTransaction,
  ): Promise<GroupUser> {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .insertInto('group_users')
          .values(insertableGroupUser)
          .returningAll()
          .executeTakeFirst();
      },
      trx,
    );
  }

  async getGroupUsersPaginated(
    groupId: string,
    paginationOptions: PaginationOptions,
  ): Promise<{ users: User[]; count: number }> {
    // todo add group member count
    return executeTx(this.db, async (trx) => {
      const groupUsers = (await trx
        .selectFrom('group_users')
        .innerJoin('users', 'users.id', 'group_users.userId')
        .select(sql<User>`users.*` as any)
        .where('groupId', '=', groupId)
        .limit(paginationOptions.limit)
        .offset(paginationOptions.offset)
        .execute()) as User[];

      const users: User[] = groupUsers.map((user: User) => {
        delete user.password;
        return user;
      });

      let { count } = await trx
        .selectFrom('group_users')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('groupId', '=', groupId)
        .executeTakeFirst();

      count = count as number;

      return { users, count };
    });
  }

  async delete(userId: string, groupId: string): Promise<void> {
    await this.db
      .deleteFrom('group_users')
      .where('userId', '=', userId)
      .where('groupId', '=', groupId)
      .execute();
  }
}
