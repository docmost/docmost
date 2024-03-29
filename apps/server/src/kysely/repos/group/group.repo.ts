import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import {
  Group,
  InsertableGroup,
  UpdatableGroup,
} from '@docmost/db/types/entity.types';
import { sql } from 'kysely';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';

@Injectable()
export class GroupRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(groupId: string, workspaceId: string): Promise<Group> {
    return await this.db
      .selectFrom('groups')
      .selectAll()
      .where('id', '=', groupId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findByName(groupName: string, workspaceId: string): Promise<Group> {
    return await this.db
      .selectFrom('groups')
      .selectAll()
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
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .insertInto('groups')
          .values(insertableGroup)
          .returningAll()
          .executeTakeFirst();
      },
      trx,
    );
  }

  async getDefaultGroup(
    workspaceId: string,
    trx: KyselyTransaction,
  ): Promise<Group> {
    return executeTx(
      this.db,
      async (trx) => {
        return await trx
          .selectFrom('groups')
          .selectAll()
          .where('isDefault', '=', true)
          .where('workspaceId', '=', workspaceId)

          .executeTakeFirst();
      },
      trx,
    );
  }

  async getGroupsPaginated(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    // todo add group member count
    return executeTx(this.db, async (trx) => {
      const groups = await trx
        .selectFrom('groups')
        .selectAll()
        .where('workspaceId', '=', workspaceId)
        .limit(paginationOptions.limit)
        .offset(paginationOptions.offset)
        .execute();

      let { count } = await trx
        .selectFrom('groups')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst();

      count = count as number;
      return { groups, count };
    });
  }

  async delete(groupId: string, workspaceId: string): Promise<void> {
    await this.db
      .deleteFrom('groups')
      .where('id', '=', groupId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}
