import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  Group,
  InsertableGroup,
  UpdatableGroup,
} from '@docmost/db/types/entity.types';
import { ExpressionBuilder, sql } from 'kysely';
import { PaginationOptions } from '../../pagination/pagination-options';
import { DB } from '@docmost/db/types/db';
import { executeWithPagination } from '@docmost/db/pagination/pagination';

@Injectable()
export class GroupRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof Group> = [
    'id',
    'name',
    'description',
    'isDefault',
    'workspaceId',
    'creatorId',
    'createdAt',
    'updatedAt',
  ];

  countGroupMembers(eb: ExpressionBuilder<DB, 'groups'>) {
    return eb
      .selectFrom('groupUsers')
      .select((eb) => eb.fn.countAll().as('count'))
      .whereRef('groupUsers.groupId', '=', 'groups.id')
      .as('memberCount');
  }

  async findById(groupId: string, workspaceId: string): Promise<Group> {
    return await this.db
      .selectFrom('groups')
      .select((eb) => [...this.baseFields, this.countGroupMembers(eb)])
      .where('id', '=', groupId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findByName(groupName: string, workspaceId: string): Promise<Group> {
    return await this.db
      .selectFrom('groups')
      .select((eb) => [...this.baseFields, this.countGroupMembers(eb)])
      .where(sql`LOWER(name)`, '=', sql`LOWER(${groupName})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async update(
    updatableGroup: UpdatableGroup,
    groupId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .updateTable('groups')
      .set(updatableGroup)
      .where('id', '=', groupId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async insertGroup(
    insertableGroup: InsertableGroup,
    trx?: KyselyTransaction,
  ): Promise<Group> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('groups')
      .values(insertableGroup)
      .returningAll()
      .executeTakeFirst();
  }

  async getDefaultGroup(
    workspaceId: string,
    trx: KyselyTransaction,
  ): Promise<Group> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('groups')
      .select((eb) => [...this.baseFields, this.countGroupMembers(eb)])
      .where('isDefault', '=', true)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async getGroupsPaginated(workspaceId: string, pagination: PaginationOptions) {
    let query = this.db
      .selectFrom('groups')
      .select((eb) => [...this.baseFields, this.countGroupMembers(eb)])
      .where('workspaceId', '=', workspaceId)
      .orderBy('createdAt', 'asc');

    if (pagination.query) {
      query = query.where((eb) =>
        eb('name', 'ilike', `%${pagination.query}%`).or(
          'description',
          'ilike',
          `%${pagination.query}%`,
        ),
      );
    }

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    return result;
  }

  async delete(groupId: string, workspaceId: string): Promise<void> {
    await this.db
      .deleteFrom('groups')
      .where('id', '=', groupId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}
