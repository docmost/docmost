import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertableSpace,
  Space,
  UpdatableSpace,
} from '@docmost/db/types/entity.types';
import { ExpressionBuilder, sql } from 'kysely';
import { PaginationOptions } from '../../pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { DB } from '@docmost/db/types/db';

@Injectable()
export class SpaceRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof Space> = [
    'id',
    'name',
    'description',
    'slug',
    'icon',
    'visibility',
    'defaultRole',
    'workspaceId',
    'creatorId',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  async findById(spaceId: string, workspaceId: string): Promise<Space> {
    return await this.db
      .selectFrom('spaces')
      .select((eb) => [...this.baseFields, this.countSpaceMembers(eb)])
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findBySlug(slug: string, workspaceId: string): Promise<Space> {
    return await this.db
      .selectFrom('spaces')
      .select((eb) => [...this.baseFields, this.countSpaceMembers(eb)])
      .where(sql`LOWER(slug)`, '=', sql`LOWER(${slug})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async slugExists(
    slug: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<boolean> {
    const db = dbOrTx(this.db, trx);
    let { count } = await db
      .selectFrom('spaces')
      .select((eb) => eb.fn.count('id').as('count'))
      .where(sql`LOWER(slug)`, '=', sql`LOWER(${slug})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    count = count as number;
    return count == 0 ? false : true;
  }

  async updateSpace(
    updatableSpace: UpdatableSpace,
    spaceId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
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
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('spaces')
      .values(insertableSpace)
      .returningAll()
      .executeTakeFirst();
  }

  async getSpacesInWorkspace(
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    // todo: show spaces user have access based on visibility and memberships
    let query = this.db
      .selectFrom('spaces')
      .select((eb) => [...this.baseFields, this.countSpaceMembers(eb)])
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

  countSpaceMembers(eb: ExpressionBuilder<DB, 'spaces'>) {
    // should get unique members via groups?
    return eb
      .selectFrom('spaceMembers')
      .select((eb) => eb.fn.countAll().as('count'))
      .whereRef('spaceMembers.spaceId', '=', 'spaces.id')
      .as('memberCount');
  }

  async deleteSpace(spaceId: string, workspaceId: string): Promise<void> {
    await this.db
      .deleteFrom('spaces')
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}
