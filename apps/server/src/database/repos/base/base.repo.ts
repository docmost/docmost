import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  Base,
  InsertableBase,
  UpdatableBase,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

@Injectable()
export class BaseRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof Base> = [
    'id',
    'name',
    'description',
    'icon',
    'pageId',
    'spaceId',
    'workspaceId',
    'creatorId',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  async findById(
    baseId: string,
    opts?: {
      includeProperties?: boolean;
      includeViews?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Base | undefined> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('bases')
      .select(this.baseFields)
      .where('id', '=', baseId)
      .where('deletedAt', 'is', null);

    if (opts?.includeProperties) {
      query = query.select((eb) => this.withProperties(eb));
    }

    if (opts?.includeViews) {
      query = query.select((eb) => this.withViews(eb));
    }

    return query.executeTakeFirst() as Promise<Base | undefined>;
  }

  async findBySpaceId(
    spaceId: string,
    pagination: PaginationOptions,
    opts?: { trx?: KyselyTransaction },
  ) {
    const db = dbOrTx(this.db, opts?.trx);

    const query = db
      .selectFrom('bases')
      .select(this.baseFields)
      .where('spaceId', '=', spaceId)
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

  async insertBase(
    base: InsertableBase,
    trx?: KyselyTransaction,
  ): Promise<Base> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('bases')
      .values(base)
      .returningAll()
      .executeTakeFirstOrThrow() as Promise<Base>;
  }

  async updateBase(
    baseId: string,
    data: UpdatableBase,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('bases')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', baseId)
      .execute();
  }

  async softDelete(baseId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('bases')
      .set({ deletedAt: new Date() })
      .where('id', '=', baseId)
      .execute();
  }

  private withProperties(eb: ExpressionBuilder<DB, 'bases'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('baseProperties')
        .selectAll('baseProperties')
        .whereRef('baseProperties.baseId', '=', 'bases.id')
        .orderBy('baseProperties.position', 'asc'),
    ).as('properties');
  }

  private withViews(eb: ExpressionBuilder<DB, 'bases'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('baseViews')
        .selectAll('baseViews')
        .whereRef('baseViews.baseId', '=', 'bases.id')
        .orderBy('baseViews.position', 'asc'),
    ).as('views');
  }
}
