import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  ChangeLogSetting,
  ChangeSet,
  InsertableChangeEntry,
  InsertableChangeLogSetting,
  InsertableChangeSet,
  UpdatableChangeLogSetting,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@docmost/db/types/db';

@Injectable()
export class ChangeSetRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof ChangeSet> = [
    'id',
    'pageId',
    'spaceId',
    'workspaceId',
    'reason',
    'requestedBy',
    'targetSystem',
    'ticketRef',
    'performedById',
    'correctsId',
    'createdAt',
  ];

  async findById(changeSetId: string): Promise<ChangeSet> {
    return this.db
      .selectFrom('changeSets')
      .select(this.baseFields)
      .select((eb) => this.withPerformedBy(eb))
      .select((eb) => this.withEntries(eb))
      .where('id', '=', changeSetId)
      .executeTakeFirst();
  }

  async insertChangeSet(
    insertableChangeSet: InsertableChangeSet,
    trx?: KyselyTransaction,
  ): Promise<ChangeSet> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('changeSets')
      .values(insertableChangeSet)
      .returningAll()
      .executeTakeFirst();
  }

  async insertChangeEntries(
    entries: InsertableChangeEntry[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (entries.length === 0) return;
    const db = dbOrTx(this.db, trx);
    await db.insertInto('changeEntries').values(entries).execute();
  }

  async findByScope(
    scope: { pageId?: string; spaceId?: string },
    pagination: PaginationOptions,
  ) {
    let query = this.db
      .selectFrom('changeSets')
      .select(this.baseFields)
      .select((eb) => this.withPerformedBy(eb))
      .select((eb) => this.withEntries(eb));

    if (scope.pageId) {
      query = query.where('pageId', '=', scope.pageId);
    } else {
      query = query.where('spaceId', '=', scope.spaceId);
    }

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }

  async getLatestChangeAt(pageId: string): Promise<Date | undefined> {
    const row = await this.db
      .selectFrom('changeSets')
      .select('createdAt')
      .where('pageId', '=', pageId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .executeTakeFirst();
    return row?.createdAt as Date | undefined;
  }

  async findSettingByScope(scope: {
    pageId?: string;
    spaceId?: string;
  }): Promise<ChangeLogSetting> {
    let query = this.db.selectFrom('changeLogSettings').selectAll();

    query = scope.pageId
      ? query.where('pageId', '=', scope.pageId)
      : query.where('spaceId', '=', scope.spaceId);

    return query.executeTakeFirst();
  }

  async resolveEffectiveSetting(
    pageId: string,
    spaceId: string,
  ): Promise<ChangeLogSetting | undefined> {
    const ancestorIds = await this.getAncestorPageIds(pageId);

    if (ancestorIds.length > 0) {
      const pageSettings = await this.db
        .selectFrom('changeLogSettings')
        .selectAll()
        .where('pageId', 'in', ancestorIds)
        .execute();

      if (pageSettings.length > 0) {
        const depthOf = (id: string) => ancestorIds.indexOf(id);
        return pageSettings.sort(
          (a, b) => depthOf(a.pageId) - depthOf(b.pageId),
        )[0];
      }
    }

    return this.findSettingByScope({ spaceId });
  }

  async insertSetting(
    insertableChangeLogSetting: InsertableChangeLogSetting,
  ): Promise<ChangeLogSetting> {
    return this.db
      .insertInto('changeLogSettings')
      .values(insertableChangeLogSetting)
      .returningAll()
      .executeTakeFirst();
  }

  async updateSetting(
    updatableChangeLogSetting: UpdatableChangeLogSetting,
    settingId: string,
  ): Promise<ChangeLogSetting> {
    return this.db
      .updateTable('changeLogSettings')
      .set({ ...updatableChangeLogSetting, updatedAt: new Date() })
      .where('id', '=', settingId)
      .returningAll()
      .executeTakeFirst();
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

  withPerformedBy(eb: ExpressionBuilder<DB, 'changeSets'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'changeSets.performedById'),
    ).as('performedBy');
  }

  withEntries(eb: ExpressionBuilder<DB, 'changeSets'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('changeEntries')
        .select([
          'changeEntries.id',
          'changeEntries.summary',
          'changeEntries.detail',
          'changeEntries.position',
          'changeEntries.createdAt',
        ])
        .whereRef('changeEntries.changeSetId', '=', 'changeSets.id')
        .orderBy('changeEntries.position', 'asc')
        .orderBy('changeEntries.createdAt', 'asc'),
    ).as('entries');
  }
}
