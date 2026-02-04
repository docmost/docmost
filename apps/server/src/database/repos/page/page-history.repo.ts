import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertablePageHistory,
  Page,
  PageHistory,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';

@Injectable()
export class PageHistoryRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof PageHistory> = [
    'id',
    'pageId',
    'slugId',
    'title',
    'icon',
    'coverPhoto',
    'lastUpdatedById',
    'spaceId',
    'workspaceId',
    'createdAt',
  ];

  async findById(
    pageHistoryId: string,
    opts?: {
      includeContent?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<PageHistory> {
    const db = dbOrTx(this.db, opts?.trx);

    return await db
      .selectFrom('pageHistory')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .select((eb) => this.withLastUpdatedBy(eb))
      .where('id', '=', pageHistoryId)
      .executeTakeFirst();
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

  async saveHistory(page: Page, trx?: KyselyTransaction): Promise<void> {
    await this.insertPageHistory(
      {
        pageId: page.id,
        slugId: page.slugId,
        title: page.title,
        content: page.content,
        icon: page.icon,
        coverPhoto: page.coverPhoto,
        lastUpdatedById: page.lastUpdatedById ?? page.creatorId,
        spaceId: page.spaceId,
        workspaceId: page.workspaceId,
      },
      trx,
    );
  }

  async findPageHistoryByPageId(pageId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pageHistory')
      .select(this.baseFields)
      .select((eb) => this.withLastUpdatedBy(eb))
      .where('pageId', '=', pageId);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }

  async findPageLastHistory(
    pageId: string,
    opts?: {
      includeContent?: boolean;
      trx?: KyselyTransaction;
    },
  ) {
    const db = dbOrTx(this.db, opts?.trx);

    return await db
      .selectFrom('pageHistory')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .where('pageId', '=', pageId)
      .limit(1)
      .orderBy('createdAt', 'desc')
      .executeTakeFirst();
  }

  withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pageHistory'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pageHistory.lastUpdatedById'),
    ).as('lastUpdatedBy');
  }
}
