import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertableReviewRecord,
  InsertableReviewSetting,
  ReviewSetting,
  UpdatableReviewSetting,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@docmost/db/types/db';

@Injectable()
export class ReviewRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof ReviewSetting> = [
    'id',
    'pageId',
    'spaceId',
    'workspaceId',
    'intervalDays',
    'lastReviewedAt',
    'lastReviewedById',
    'nextReviewAt',
    'createdAt',
    'updatedAt',
  ];

  async findById(reviewSettingId: string): Promise<ReviewSetting> {
    return this.db
      .selectFrom('reviewSettings')
      .select(this.baseFields)
      .select((eb) => this.withLastReviewedBy(eb))
      .where('id', '=', reviewSettingId)
      .executeTakeFirst();
  }

  async findByScope(scope: {
    pageId?: string;
    spaceId?: string;
  }): Promise<ReviewSetting> {
    let query = this.db
      .selectFrom('reviewSettings')
      .select(this.baseFields)
      .select((eb) => this.withLastReviewedBy(eb));

    query = scope.pageId
      ? query.where('pageId', '=', scope.pageId)
      : query.where('spaceId', '=', scope.spaceId);

    return query.executeTakeFirst();
  }

  async resolveEffective(
    pageId: string,
    spaceId: string,
  ): Promise<ReviewSetting | undefined> {
    const ancestorIds = await this.getAncestorPageIds(pageId);

    if (ancestorIds.length > 0) {
      const pageSettings = await this.db
        .selectFrom('reviewSettings')
        .select(this.baseFields)
        .select((eb) => this.withLastReviewedBy(eb))
        .where('pageId', 'in', ancestorIds)
        .execute();

      if (pageSettings.length > 0) {
        const depthOf = (id: string) => ancestorIds.indexOf(id);
        return pageSettings.sort(
          (a, b) => depthOf(a.pageId) - depthOf(b.pageId),
        )[0];
      }
    }

    return this.findByScope({ spaceId });
  }

  async insertSetting(
    insertableReviewSetting: InsertableReviewSetting,
    trx?: KyselyTransaction,
  ): Promise<ReviewSetting> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('reviewSettings')
      .values(insertableReviewSetting)
      .returningAll()
      .executeTakeFirst();
  }

  async updateSetting(
    updatableReviewSetting: UpdatableReviewSetting,
    reviewSettingId: string,
    trx?: KyselyTransaction,
  ): Promise<ReviewSetting> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('reviewSettings')
      .set({ ...updatableReviewSetting, updatedAt: new Date() })
      .where('id', '=', reviewSettingId)
      .returningAll()
      .executeTakeFirst();
  }

  async insertRecord(
    insertableReviewRecord: InsertableReviewRecord,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .insertInto('reviewRecords')
      .values(insertableReviewRecord)
      .execute();
  }

  async findRecords(reviewSettingId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('reviewRecords')
      .select([
        'id',
        'reviewSettingId',
        'pageId',
        'spaceId',
        'workspaceId',
        'reviewedById',
        'reviewedAt',
        'note',
        'createdAt',
      ])
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'reviewRecords.reviewedById'),
        ).as('reviewedBy'),
      )
      .where('reviewSettingId', '=', reviewSettingId);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }

  async findPageSettingsBySpace(
    spaceId: string,
  ): Promise<Array<{ pageId: string; nextReviewAt: Date | null }>> {
    const rows = await this.db
      .selectFrom('reviewSettings as rs')
      .innerJoin('pages as p', 'p.id', 'rs.pageId')
      .select(['rs.pageId as pageId', 'rs.nextReviewAt as nextReviewAt'])
      .where('p.spaceId', '=', spaceId)
      .where('p.deletedAt', 'is', null)
      .where('rs.pageId', 'is not', null)
      .execute();

    return rows as Array<{ pageId: string; nextReviewAt: Date | null }>;
  }

  private async getAncestorPageIds(pageId: string): Promise<string[]> {
    const ancestors = await this.db
      .withRecursive('page_ancestors', (db) =>
        db
          .selectFrom('pages')
          .select(['id', 'parentPageId'])
          .select(sql<number>`0`.as('depth'))
          .where('id', '=', pageId)
          .where('deletedAt', 'is', null)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select(['p.id', 'p.parentPageId'])
              .select(sql<number>`pa.depth + 1`.as('depth'))
              .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id')
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('page_ancestors')
      .select(['id', 'depth'])
      .orderBy('depth', 'asc')
      .execute();

    return ancestors.map((a) => a.id);
  }

  withLastReviewedBy(eb: ExpressionBuilder<DB, 'reviewSettings'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'reviewSettings.lastReviewedById'),
    ).as('lastReviewedBy');
  }
}
