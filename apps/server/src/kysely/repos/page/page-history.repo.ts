import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertablePageHistory,
  PageHistory,
  UpdatablePageHistory,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';

@Injectable()
export class PageHistoryRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof PageHistory> = [
    'id',
    'pageId',
    'title',
    'slug',
    'icon',
    'coverPhoto',
    'version',
    'lastUpdatedById',
    'workspaceId',
    'createdAt',
    'updatedAt',
  ];

  async findById(pageHistoryId: string): Promise<PageHistory> {
    return await this.db
      .selectFrom('pageHistory')
      .select((eb) => [...this.baseFields, this.withLastUpdatedBy(eb)])
      .where('id', '=', pageHistoryId)
      .executeTakeFirst();
  }

  async updatePageHistory(
    updatablePageHistory: UpdatablePageHistory,
    pageHistoryId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('pageHistory')
      .set(updatablePageHistory)
      .where('id', '=', pageHistoryId)
      .execute();
  }

  async insertPageHistory(
    insertablePageHistory: InsertablePageHistory,
    trx?: KyselyTransaction,
  ): Promise<PageHistory> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pageHistory')
      .values(insertablePageHistory)
      .returningAll()
      .executeTakeFirst();
  }

  async findPageHistoryByPageId(pageId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pageHistory')
      .select((eb) => [...this.baseFields, this.withLastUpdatedBy(eb)])
      .where('pageId', '=', pageId)
      .orderBy('createdAt', 'desc');

    const result = executeWithPagination(query, {
      page: pagination.offset,
      perPage: pagination.limit,
    });

    return result;
  }

  withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pageHistory'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pageHistory.lastUpdatedById'),
    ).as('withLastUpdatedBy');
  }
}
