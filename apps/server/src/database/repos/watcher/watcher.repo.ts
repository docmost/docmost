import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { InsertableWatcher, Watcher } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
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

  async findPageWatchers(pageId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('watchers')
      .selectAll('watchers')
      .select((eb) => this.withUser(eb))
      .where('pageId', '=', pageId)
      .where('type', '=', WatcherType.PAGE)
      .where('mutedAt', 'is', null);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'asc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
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
      .where('mutedAt', 'is', null)
      .execute();

    return watchers.map((w) => w.userId);
  }

  /**
   * Recipients for a `page.updated` notification, combining:
   *   - Active page watchers on this page, AND
   *   - Active space watchers on this space, EXCLUDING any user who has a
   *     muted page watcher row for this page (per-page mute always wins).
   *
   * Deduplicated at the SQL level — a user watching both the page and the
   * containing space appears once.
   */
  async getPageUpdateRecipientIds(
    pageId: string,
    spaceId: string,
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    const db = dbOrTx(this.db, trx);

    const pageWatchers = db
      .selectFrom('watchers')
      .select('userId')
      .where('pageId', '=', pageId)
      .where('type', '=', WatcherType.PAGE)
      .where('mutedAt', 'is', null);

    const spaceWatchers = db
      .selectFrom('watchers as sw')
      .select('sw.userId')
      .where('sw.spaceId', '=', spaceId)
      .where('sw.pageId', 'is', null)
      .where('sw.type', '=', WatcherType.SPACE)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('watchers as pw')
              .select('pw.id')
              .whereRef('pw.userId', '=', 'sw.userId')
              .where('pw.pageId', '=', pageId)
              .where('pw.type', '=', WatcherType.PAGE)
              .where('pw.mutedAt', 'is not', null),
          ),
        ),
      );

    const rows = await pageWatchers.union(spaceWatchers).execute();
    return [...new Set(rows.map((r) => r.userId))];
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

  async upsert(
    watcher: InsertableWatcher,
    trx?: KyselyTransaction,
  ): Promise<Watcher | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('watchers')
      .values(watcher)
      .onConflict((oc) =>
        oc
          .columns(['userId', 'pageId'])
          .where('pageId', 'is not', null)
          .doUpdateSet({ mutedAt: null }),
      )
      .returningAll()
      .executeTakeFirst();
  }

  async upsertSpace(
    watcher: InsertableWatcher,
    trx?: KyselyTransaction,
  ): Promise<Watcher | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('watchers')
      .values(watcher)
      .onConflict((oc) =>
        oc
          .columns(['userId', 'spaceId'])
          .where('pageId', 'is', null)
          .doNothing(),
      )
      .returningAll()
      .executeTakeFirst();
  }

  async mute(
    userId: string,
    pageId: string,
    spaceId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    const mutedAt = new Date();
    await db
      .insertInto('watchers')
      .values({
        userId,
        pageId,
        spaceId,
        workspaceId,
        type: WatcherType.PAGE,
        addedById: userId,
        mutedAt,
      })
      .onConflict((oc) =>
        oc
          .columns(['userId', 'pageId'])
          .where('pageId', 'is not', null)
          .doUpdateSet({ mutedAt }),
      )
      .execute();
  }

  async deleteSpaceWatch(
    userId: string,
    spaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('watchers')
      .where('userId', '=', userId)
      .where('spaceId', '=', spaceId)
      .where('pageId', 'is', null)
      .where('type', '=', WatcherType.SPACE)
      .execute();
  }

  async getWatchedSpaceIds(userId: string, workspaceId: string) {
    const query = this.db
      .selectFrom('watchers')
      .select(['watchers.id', 'watchers.spaceId'])
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('pageId', 'is', null)
      .where('type', '=', WatcherType.SPACE);

    return executeWithCursorPagination(query, {
      perPage: 250,
      fields: [{ expression: 'watchers.id', direction: 'asc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }

  async isWatchingSpace(userId: string, spaceId: string): Promise<boolean> {
    const watcher = await this.db
      .selectFrom('watchers')
      .select('id')
      .where('userId', '=', userId)
      .where('spaceId', '=', spaceId)
      .where('pageId', 'is', null)
      .where('type', '=', WatcherType.SPACE)
      .executeTakeFirst();

    return !!watcher;
  }

  async isWatching(userId: string, pageId: string): Promise<boolean> {
    const watcher = await this.db
      .selectFrom('watchers')
      .select('id')
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .where('mutedAt', 'is', null)
      .executeTakeFirst();

    return !!watcher;
  }

  async countPageWatchers(pageId: string): Promise<number> {
    const result = await this.db
      .selectFrom('watchers')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('pageId', '=', pageId)
      .where('type', '=', WatcherType.PAGE)
      .where('mutedAt', 'is', null)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  async deleteByUsersWithoutSpaceAccess(
    userIds: string[],
    spaceId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<void> {
    if (userIds.length === 0) return;

    const { trx } = opts;
    const db = dbOrTx(this.db, trx);

    const usersWithAccess = db
      .selectFrom('spaceMembers')
      .select('userId')
      .where('spaceId', '=', spaceId)
      .where('userId', 'is not', null)
      .union(
        db
          .selectFrom('spaceMembers')
          .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
          .select('groupUsers.userId')
          .where('spaceMembers.spaceId', '=', spaceId),
      );

    await db
      .deleteFrom('watchers')
      .where('userId', 'in', userIds)
      .where('spaceId', '=', spaceId)
      .where('userId', 'not in', usersWithAccess)
      .execute();
  }

  async updateSpaceIdByPageIds(
    spaceId: string,
    pageIds: string[],
    opts?: { trx?: KyselyTransaction },
  ): Promise<void> {
    if (pageIds.length === 0) return;
    const { trx } = opts;
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('watchers')
      .set({ spaceId })
      .where('pageId', 'in', pageIds)
      .execute();
  }

  async deleteByPageIdsWithoutSpaceAccess(
    pageIds: string[],
    spaceId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<void> {
    if (pageIds.length === 0) return;
    const { trx } = opts;
    const db = dbOrTx(this.db, trx);

    const usersWithAccess = db
      .selectFrom('spaceMembers')
      .select('userId')
      .where('spaceId', '=', spaceId)
      .where('userId', 'is not', null)
      .union(
        db
          .selectFrom('spaceMembers')
          .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
          .select('groupUsers.userId')
          .where('spaceMembers.spaceId', '=', spaceId),
      );

    await db
      .deleteFrom('watchers')
      .where('pageId', 'in', pageIds)
      .where('userId', 'not in', usersWithAccess)
      .execute();
  }

  async deleteByUserAndWorkspace(
    userId: string,
    workspaceId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<void> {
    const { trx } = opts;

    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('watchers')
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .execute();
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
