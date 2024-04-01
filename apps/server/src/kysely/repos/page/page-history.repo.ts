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

@Injectable()
export class PageHistoryRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(pageHistoryId: string): Promise<PageHistory> {
    return await this.db
      .selectFrom('pageHistory')
      .selectAll()
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
    // todo: fix user relationship
    const query = this.db
      .selectFrom('pageHistory as history')
      .innerJoin('users as user', 'user.id', 'history.lastUpdatedById')
      .select([
        'history.id',
        'history.pageId',
        'history.title',
        'history.slug',
        'history.icon',
        'history.coverPhoto',
        'history.version',
        'history.lastUpdatedById',
        'history.workspaceId',
        'history.createdAt',
        'history.updatedAt',
        'user.id',
        'user.name',
        'user.avatarUrl',
      ])
      .where('pageId', '=', pageId)
      .orderBy('createdAt', 'desc');

    const result = executeWithPagination(query, {
      page: pagination.offset,
      perPage: pagination.limit,
    });

    return result;
  }
}
