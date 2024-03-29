import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import {
  InsertableSpace,
  Space,
  UpdatableSpace,
} from '@docmost/db/types/entity.types';
import { sql } from 'kysely';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';

@Injectable()
export class SpaceRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(spaceId: string, workspaceId: string): Promise<Space> {
    return await this.db
      .selectFrom('spaces')
      .selectAll()
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findBySlug(slug: string, workspaceId: string): Promise<Space> {
    return await this.db
      .selectFrom('spaces')
      .selectAll()
      .where(sql`LOWER(slug)`, '=', sql`LOWER(${slug})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async slugExists(slug: string, workspaceId: string): Promise<boolean> {
    let { count } = await this.db
      .selectFrom('spaces')
      .select((eb) => eb.fn.count('id').as('count'))
      .where(sql`LOWER(slug)`, '=', sql`LOWER(${slug})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    count = count as number;

    return !!count;
  }

  async updateSpace(
    updatableSpace: UpdatableSpace,
    spaceId: string,
    workspaceId: string,
  ) {
    return await this.db
      .updateTable('spaces')
      .set(updatableSpace)
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async insertSpace(
    insertableSpace: InsertableSpace,
    trx?: KyselyTransaction,
  ): Promise<Space> {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .insertInto('spaces')
          .values(insertableSpace)
          .returningAll()
          .executeTakeFirst();
      },
      trx,
    );
  }

  async getSpacesInWorkspace(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    //todo: add member count
    // to: show spaces user have access based on visibility and membership

    return executeTx(this.db, async (trx) => {
      const spaces = await trx
        .selectFrom('spaces')
        .selectAll()
        .where('workspaceId', '=', workspaceId)
        .limit(paginationOptions.limit)
        .offset(paginationOptions.offset)
        .execute();

      let { count } = await trx
        .selectFrom('spaces')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst();

      count = count as number;
      return { spaces, count };
    });
  }

  async deleteSpace(spaceId: string, workspaceId: string): Promise<void> {
    await this.db
      .deleteFrom('spaces')
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}
