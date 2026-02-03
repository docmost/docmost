import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { InsertableWatcher, Watcher } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { dbOrTx } from '@docmost/db/utils';

export const WatcherType = {
  PAGE: 'page',
  SPACE: 'space',
} as const;

export type WatcherType = (typeof WatcherType)[keyof typeof WatcherType];

@Injectable()
export class WatcherRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByUserAndPage(
    userId: string,
    pageId: string,
  ): Promise<Watcher | undefined> {
    return this.db
      .selectFrom('watchers')
      .selectAll()
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .executeTakeFirst();
  }

  async findPageWatchers(pageId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('watchers')
      .selectAll('watchers')
      .select((eb) => this.withUser(eb))
      .where('pageId', '=', pageId)
      .where('type', '=', WatcherType.PAGE)
      .orderBy('createdAt', 'asc');

    return executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });
  }

  async getPageWatcherIds(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    const db = dbOrTx(this.db, trx);
    const watchers = await db
      .selectFrom('watchers')
      .select('userId')
      .where('pageId', '=', pageId)
      .where('type', '=', WatcherType.PAGE)
      .execute();

    return watchers.map((w) => w.userId);
  }

  async insert(
    watcher: InsertableWatcher,
    trx?: KyselyTransaction,
  ): Promise<Watcher | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('watchers')
      .values(watcher)
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();
  }

  async insertMany(
    watchers: InsertableWatcher[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (watchers.length === 0) return;
    const db = dbOrTx(this.db, trx);
    await db
      .insertInto('watchers')
      .values(watchers)
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async delete(
    userId: string,
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('watchers')
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .execute();
  }

  async isWatching(userId: string, pageId: string): Promise<boolean> {
    const watcher = await this.db
      .selectFrom('watchers')
      .select('id')
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .executeTakeFirst();

    return !!watcher;
  }

  async countPageWatchers(pageId: string): Promise<number> {
    const result = await this.db
      .selectFrom('watchers')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('pageId', '=', pageId)
      .where('type', '=', WatcherType.PAGE)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  withUser(eb: ExpressionBuilder<DB, 'watchers'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl', 'users.email'])
        .whereRef('users.id', '=', 'watchers.userId'),
    ).as('user');
  }
}
