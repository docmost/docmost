import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  BaseRow,
  InsertableBaseRow,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { sql } from 'kysely';

@Injectable()
export class BaseRowRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    rowId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<BaseRow | undefined> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .selectFrom('baseRows')
      .selectAll()
      .where('id', '=', rowId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst() as Promise<BaseRow | undefined>;
  }

  async findByBaseId(
    baseId: string,
    pagination: PaginationOptions,
    opts?: { trx?: KyselyTransaction },
  ) {
    const db = dbOrTx(this.db, opts?.trx);

    const query = db
      .selectFrom('baseRows')
      .selectAll()
      .where('baseId', '=', baseId)
      .where('deletedAt', 'is', null);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'position', direction: 'asc' },
        { expression: 'id', direction: 'asc' },
      ],
      parseCursor: (cursor) => ({
        position: cursor.position,
        id: cursor.id,
      }),
    });
  }

  async getLastPosition(
    baseId: string,
    trx?: KyselyTransaction,
  ): Promise<string | null> {
    const db = dbOrTx(this.db, trx);
    const result = await db
      .selectFrom('baseRows')
      .select('position')
      .where('baseId', '=', baseId)
      .where('deletedAt', 'is', null)
      .orderBy(sql`position COLLATE "C"`, sql`DESC`)
      .limit(1)
      .executeTakeFirst();
    return result?.position ?? null;
  }

  async insertRow(
    row: InsertableBaseRow,
    trx?: KyselyTransaction,
  ): Promise<BaseRow> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('baseRows')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow() as Promise<BaseRow>;
  }

  async updateCells(
    rowId: string,
    cells: Record<string, unknown>,
    userId?: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseRows')
      .set({
        cells: sql`cells || ${cells}`,
        updatedAt: new Date(),
        lastUpdatedById: userId ?? null,
      })
      .where('id', '=', rowId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async updatePosition(
    rowId: string,
    position: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseRows')
      .set({ position, updatedAt: new Date() })
      .where('id', '=', rowId)
      .execute();
  }

  async softDelete(rowId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseRows')
      .set({ deletedAt: new Date() })
      .where('id', '=', rowId)
      .execute();
  }

  async removeCellKey(
    baseId: string,
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseRows')
      .set({
        cells: sql`cells - ${propertyId}`,
        updatedAt: new Date(),
      })
      .where('baseId', '=', baseId)
      .execute();
  }

  async findAllByBaseId(
    baseId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseRow[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('baseRows')
      .selectAll()
      .where('baseId', '=', baseId)
      .where('deletedAt', 'is', null)
      .execute() as Promise<BaseRow[]>;
  }

  async batchUpdateCells(
    updates: Array<{ id: string; cells: Record<string, unknown> }>,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    for (const update of updates) {
      await db
        .updateTable('baseRows')
        .set({
          cells: sql`cells || ${update.cells}`,
          updatedAt: new Date(),
        })
        .where('id', '=', update.id)
        .execute();
    }
  }
}
