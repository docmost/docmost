import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { Users } from '@docmost/db/types/db';
import { hashPassword } from '../../../helpers/utils';
import { executeTx } from '@docmost/db/utils';
import {
  InsertableUser,
  UpdatableUser,
  User,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';

@Injectable()
export class UserRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof Users> = [
    'id',
    'email',
    'name',
    'emailVerifiedAt',
    'avatarUrl',
    'role',
    'workspaceId',
    'locale',
    'timezone',
    'settings',
    'lastLoginAt',
    'createdAt',
    'updatedAt',
  ];

  async findById(
    userId: string,
    workspaceId: string,
    includePassword?: boolean,
  ): Promise<User> {
    return this.db
      .selectFrom('users')
      .select(this.baseFields)
      .$if(includePassword, (qb) => qb.select('password'))
      .where('id', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findByEmail(
    email: string,
    workspaceId: string,
    includePassword?: boolean,
  ): Promise<User> {
    return this.db
      .selectFrom('users')
      .select(this.baseFields)
      .$if(includePassword, (qb) => qb.select('password'))
      .where('email', '=', email)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async updateUser(
    updatableUser: UpdatableUser,
    userId: string,
    workspaceId: string,
  ) {
    return await this.db
      .updateTable('users')
      .set(updatableUser)
      .where('id', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async updateLastLogin(userId: string, workspaceId: string) {
    return await this.db
      .updateTable('users')
      .set({
        lastLoginAt: new Date(),
      })
      .where('id', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async insertUser(
    insertableUser: InsertableUser,
    trx?: KyselyTransaction,
  ): Promise<User> {
    const user: InsertableUser = {
      name: insertableUser.name || insertableUser.email.split('@')[0],
      email: insertableUser.email.toLowerCase(),
      password: await hashPassword(insertableUser.password),
      locale: 'en',
      lastLoginAt: new Date(),
    };

    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .insertInto('users')
          .values(user)
          .returningAll()
          .executeTakeFirst();
      },
      trx,
    );
  }

  async roleCountByWorkspaceId(
    role: string,
    workspaceId: string,
  ): Promise<number> {
    const { count } = await this.db
      .selectFrom('users')
      .select((eb) => eb.fn.count('role').as('count'))
      .where('role', '=', role)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    return count as number;
  }

  async getUsersPaginated(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    return executeTx(this.db, async (trx) => {
      const users = await trx
        .selectFrom('users')
        .select(this.baseFields)
        .where('workspaceId', '=', workspaceId)
        .orderBy('createdAt asc')
        .limit(paginationOptions.limit)
        .offset(paginationOptions.offset)
        .execute();

      let { count } = await trx
        .selectFrom('users')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst();

      count = count as number;
      return { users, count };
    });
  }
}
