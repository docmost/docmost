import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql, ExpressionBuilder } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import { DB } from '@docmost/db/types/db';
import { Page } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';

export type BasePage = Page & {
  properties?: unknown[];
  views?: unknown[];
};

@Injectable()
export class BaseRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  // The "base id" is the page id of an is_base=true page.
  async findById(
    pageId: string,
    opts?: {
      includeProperties?: boolean;
      includeViews?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<BasePage | undefined> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('pages')
      .selectAll('pages')
      .where('id', '=', pageId)
      .where('isBase', '=', true)
      .where('deletedAt', 'is', null);

    if (opts?.includeProperties) {
      query = query.select((eb) => this.withProperties(eb));
    }
    if (opts?.includeViews) {
      query = query.select((eb) => this.withViews(eb));
    }

    return query.executeTakeFirst() as Promise<BasePage | undefined>;
  }

  async findBySpaceId(
    spaceId: string,
    pagination: PaginationOptions,
    opts?: { trx?: KyselyTransaction },
  ) {
    const db = dbOrTx(this.db, opts?.trx);

    const query = db
      .selectFrom('pages')
      .selectAll('pages')
      .where('spaceId', '=', spaceId)
      .where('isBase', '=', true)
      .where('deletedAt', 'is', null);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'createdAt', direction: 'desc' },
        { expression: 'id', direction: 'desc' },
      ],
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      }),
    });
  }

  async softDelete(pageId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('pages')
      .set({ deletedAt: new Date() })
      .where('id', '=', pageId)
      .where('isBase', '=', true)
      .execute();
  }

  async bumpSchemaVersion(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);
    const result = await db
      .updateTable('pages')
      .set({
        baseSchemaVersion: sql`base_schema_version + 1`,
        updatedAt: new Date(),
      })
      .where('id', '=', pageId)
      .where('isBase', '=', true)
      .returning('baseSchemaVersion')
      .executeTakeFirst();
    return result?.baseSchemaVersion ?? 0;
  }

  private withProperties(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('baseProperties')
        .selectAll('baseProperties')
        .whereRef('baseProperties.pageId', '=', 'pages.id')
        .where('baseProperties.deletedAt', 'is', null)
        .orderBy('baseProperties.position', 'asc'),
    ).as('properties');
  }

  private withViews(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('baseViews')
        .selectAll('baseViews')
        .whereRef('baseViews.pageId', '=', 'pages.id')
        .orderBy('baseViews.position', 'asc'),
    ).as('views');
  }
}
