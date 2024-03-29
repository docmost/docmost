import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { executeTx } from '../../utils';
import {
  InsertablePageHistory,
  PageHistory,
  UpdatablePageHistory,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from 'src/helpers/pagination/pagination-options';

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
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .updateTable('pageHistory')
          .set(updatablePageHistory)
          .where('id', '=', pageHistoryId)
          .execute();
      },
      trx,
    );
  }

  async insertPageHistory(
    insertablePageHistory: InsertablePageHistory,
    trx?: KyselyTransaction,
  ): Promise<PageHistory> {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .insertInto('pageHistory')
          .values(insertablePageHistory)
          .returningAll()
          .executeTakeFirst();
      },
      trx,
    );
  }

  async findPageHistoryByPageId(
    pageId: string,
    paginationOptions: PaginationOptions,
  ) {
    return executeTx(this.db, async (trx) => {
      const pageHistory = await trx
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
        .orderBy('createdAt', 'desc')
        .limit(paginationOptions.limit)
        .offset(paginationOptions.offset)
        .execute();

      let { count } = await trx
        .selectFrom('pageHistory')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('pageId', '=', pageId)
        .executeTakeFirst();

      count = count as number;
      return { pageHistory, count };
    });
  }
}
