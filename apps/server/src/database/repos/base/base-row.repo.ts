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
import { sql, SelectQueryBuilder, SqlBool } from 'kysely';
import { DB } from '@docmost/db/types/db';

const SYSTEM_COLUMN_MAP: Record<string, string> = {
  createdAt: 'createdAt',
  lastEditedAt: 'updatedAt',
  lastEditedBy: 'lastUpdatedById',
};

const ARRAY_TYPES = new Set(['multiSelect', 'person', 'file']);

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

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

  async findByBaseIdFiltered(
    baseId: string,
    filters: Array<{ propertyId: string; operator: string; value?: unknown }>,
    sorts: Array<{ propertyId: string; direction: string }>,
    propertyTypeMap: Map<string, string>,
    pagination: PaginationOptions,
    opts?: { trx?: KyselyTransaction },
  ) {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('baseRows')
      .selectAll()
      .where('baseId', '=', baseId)
      .where('deletedAt', 'is', null) as SelectQueryBuilder<DB, 'baseRows', any>;

    // Apply filters
    for (const filter of filters) {
      query = this.applyFilter(query, filter, propertyTypeMap);
    }

    // Build cursor-compatible sort fields.
    // COALESCE sort expressions so NULLs never reach the cursor encoder/comparator.
    // ASC NULLS LAST  → COALESCE(expr, <high sentinel>)
    // DESC NULLS LAST → COALESCE(expr, <low sentinel>)
    const sortMeta: Array<{
      alias: string;
      expression: ReturnType<typeof sql>;
      direction: 'asc' | 'desc';
      isNumeric: boolean;
    }> = [];

    for (let i = 0; i < sorts.length; i++) {
      const sort = sorts[i];
      const type = propertyTypeMap.get(sort.propertyId);
      if (!type) continue;

      const dir = (sort.direction === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
      const alias = `s${i}`;
      let expression: ReturnType<typeof sql>;
      let isNumeric = false;

      const systemCol = SYSTEM_COLUMN_MAP[type];
      if (systemCol) {
        // System columns (createdAt, updatedAt) are NOT NULL — no COALESCE needed
        expression = sql`"${sql.raw(systemCol)}"`;
      } else if (type === 'number') {
        isNumeric = true;
        const sentinel = dir === 'asc' ? "'Infinity'::numeric" : "'-Infinity'::numeric";
        expression = sql`COALESCE((cells->>'${sql.raw(sort.propertyId)}')::numeric, ${sql.raw(sentinel)})`;
      } else {
        // Text, date, select, etc.
        const sentinel = dir === 'asc' ? 'chr(1114111)' : "''";
        expression = sql`COALESCE(cells->>'${sql.raw(sort.propertyId)}', ${sql.raw(sentinel)})`;
      }

      sortMeta.push({ alias, expression, direction: dir, isNumeric });
      query = query.select(expression.as(alias)) as any;
    }

    // Cursor pagination fields: sort aliases + position + id tiebreakers.
    // executeWithCursorPagination applies ORDER BY and builds the keyset WHERE from these.
    const fields = [
      ...sortMeta.map(({ alias, expression, direction }) => ({
        expression,
        direction,
        key: alias,
      })),
      { expression: 'position' as any, direction: 'asc' as const, key: 'position' },
      { expression: 'id' as any, direction: 'asc' as const, key: 'id' },
    ];

    return executeWithCursorPagination(query as any, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: fields as any,
      encodeCursor: (values: Array<[string, unknown]>) => {
        const cursor = new URLSearchParams();
        for (const [key, value] of values) {
          if (value === null || value === undefined) {
            cursor.set(key, '__null__');
          } else if (value instanceof Date) {
            cursor.set(key, value.toISOString());
          } else {
            cursor.set(key, String(value));
          }
        }
        return Buffer.from(cursor.toString(), 'utf8').toString('base64url');
      },
      decodeCursor: (cursorStr: string, fieldNames: string[]) => {
        const parsed = new URLSearchParams(
          Buffer.from(cursorStr, 'base64url').toString('utf8'),
        );
        const result: Record<string, string> = {};
        for (const name of fieldNames) {
          result[name] = parsed.get(name) ?? '';
        }
        return result;
      },
      parseCursor: (decoded: any) => {
        const result: Record<string, unknown> = {};
        for (const { alias, isNumeric } of sortMeta) {
          const val = decoded[alias];
          if (val === '__null__') {
            result[alias] = null;
          } else {
            result[alias] = isNumeric ? parseFloat(val) : val;
          }
        }
        result.position = decoded.position;
        result.id = decoded.id;
        return result;
      },
    } as any);
  }

  private applyFilter(
    query: SelectQueryBuilder<DB, 'baseRows', any>,
    filter: { propertyId: string; operator: string; value?: unknown },
    propertyTypeMap: Map<string, string>,
  ): SelectQueryBuilder<DB, 'baseRows', any> {
    const { propertyId, operator, value } = filter;
    const propertyType = propertyTypeMap.get(propertyId);
    if (!propertyType) return query;

    // System property -> use actual column
    const systemCol = SYSTEM_COLUMN_MAP[propertyType];
    if (systemCol) {
      return this.applyColumnFilter(query, systemCol, operator, value, propertyType);
    }

    const isArray = ARRAY_TYPES.has(propertyType);

    // isEmpty / isNotEmpty don't need a value
    if (operator === 'isEmpty') {
      if (isArray) {
        return query.where(({ or, eb }) =>
          or([
            eb(sql.raw(`cells->'${propertyId}'`), 'is', null),
            eb(sql`jsonb_array_length(cells->'${sql.raw(propertyId)}')`, '=', 0),
          ]),
        );
      }
      return query.where(({ or, eb }) =>
        or([
          eb(sql.raw(`cells->>'${propertyId}'`), 'is', null),
          eb(sql.raw(`cells->>'${propertyId}'`), '=', ''),
        ]),
      );
    }

    if (operator === 'isNotEmpty') {
      if (isArray) {
        return query
          .where(sql.raw(`cells->'${propertyId}'`), 'is not', null)
          .where(sql`jsonb_array_length(cells->'${sql.raw(propertyId)}')`, '>', 0);
      }
      return query
        .where(sql.raw(`cells->>'${propertyId}'`), 'is not', null)
        .where(sql.raw(`cells->>'${propertyId}'`), '!=', '');
    }

    if (value === undefined || value === null) return query;

    // contains / notContains - text search
    if (operator === 'contains') {
      return query.where(
        sql.raw(`cells->>'${propertyId}'`),
        'ilike',
        `%${escapeIlike(String(value))}%`,
      );
    }
    if (operator === 'notContains') {
      return query.where(({ or, eb }) =>
        or([
          eb(sql.raw(`cells->>'${propertyId}'`), 'is', null),
          eb(
            sql.raw(`cells->>'${propertyId}'`),
            'not ilike',
            `%${escapeIlike(String(value))}%`,
          ),
        ]),
      );
    }

    // equals / notEquals
    if (operator === 'equals') {
      if (isArray) {
        return query.where(
          sql<SqlBool>`cells->'${sql.raw(propertyId)}' @> ${JSON.stringify([value])}::jsonb`,
        );
      }
      if (propertyType === 'number') {
        return query.where(
          sql<SqlBool>`(cells->>'${sql.raw(propertyId)}')::numeric = ${Number(value)}`,
        );
      }
      if (propertyType === 'checkbox') {
        return query.where(
          sql<SqlBool>`(cells->>'${sql.raw(propertyId)}')::boolean = ${Boolean(value)}`,
        );
      }
      return query.where(sql.raw(`cells->>'${propertyId}'`), '=', String(value));
    }

    if (operator === 'notEquals') {
      if (isArray) {
        return query.where(({ or, eb }) =>
          or([
            eb(sql.raw(`cells->'${propertyId}'`), 'is', null),
            sql<SqlBool>`NOT (cells->'${sql.raw(propertyId)}' @> ${JSON.stringify([value])}::jsonb)`,
          ]),
        );
      }
      if (propertyType === 'number') {
        return query.where(
          sql<SqlBool>`(cells->>'${sql.raw(propertyId)}')::numeric != ${Number(value)}`,
        );
      }
      if (propertyType === 'checkbox') {
        return query.where(
          sql<SqlBool>`(cells->>'${sql.raw(propertyId)}')::boolean != ${Boolean(value)}`,
        );
      }
      return query.where(({ or, eb }) =>
        or([
          eb(sql.raw(`cells->>'${propertyId}'`), 'is', null),
          eb(sql.raw(`cells->>'${propertyId}'`), '!=', String(value)),
        ]),
      );
    }

    // greaterThan / lessThan - number
    if (operator === 'greaterThan') {
      return query.where(
        sql<SqlBool>`(cells->>'${sql.raw(propertyId)}')::numeric > ${Number(value)}`,
      );
    }
    if (operator === 'lessThan') {
      return query.where(
        sql<SqlBool>`(cells->>'${sql.raw(propertyId)}')::numeric < ${Number(value)}`,
      );
    }

    // before / after - date
    if (operator === 'before') {
      return query.where(sql.raw(`cells->>'${propertyId}'`), '<', String(value));
    }
    if (operator === 'after') {
      return query.where(sql.raw(`cells->>'${propertyId}'`), '>', String(value));
    }

    return query;
  }

  private applyColumnFilter(
    query: SelectQueryBuilder<DB, 'baseRows', any>,
    column: string,
    operator: string,
    value: unknown,
    propertyType: string,
  ): SelectQueryBuilder<DB, 'baseRows', any> {
    if (operator === 'isEmpty') {
      return query.where(sql.raw(`"${column}"`), 'is', null);
    }
    if (operator === 'isNotEmpty') {
      return query.where(sql.raw(`"${column}"`), 'is not', null);
    }

    if (value === undefined || value === null) return query;

    if (operator === 'equals') {
      return query.where(sql.raw(`"${column}"`), '=', value);
    }
    if (operator === 'notEquals') {
      return query.where(({ or, eb }) =>
        or([
          eb(sql.raw(`"${column}"`), 'is', null),
          eb(sql.raw(`"${column}"`), '!=', value),
        ]),
      );
    }
    if (operator === 'before') {
      return query.where(sql.raw(`"${column}"`), '<', value);
    }
    if (operator === 'after') {
      return query.where(sql.raw(`"${column}"`), '>', value);
    }

    return query;
  }

  private applySort(
    query: SelectQueryBuilder<DB, 'baseRows', any>,
    sort: { propertyId: string; direction: string },
    propertyTypeMap: Map<string, string>,
  ): SelectQueryBuilder<DB, 'baseRows', any> {
    const { propertyId, direction } = sort;
    const propertyType = propertyTypeMap.get(propertyId);
    if (!propertyType) return query;

    const dir = direction === 'desc' ? 'desc' : 'asc';

    // System property -> use actual column
    const systemCol = SYSTEM_COLUMN_MAP[propertyType];
    if (systemCol) {
      return query.orderBy(sql.raw(`"${systemCol}"`), sql`${sql.raw(dir)} NULLS LAST`);
    }

    // Number properties: cast to numeric for proper numeric ordering
    if (propertyType === 'number') {
      return query.orderBy(
        sql`(cells->>'${sql.raw(propertyId)}')::numeric`,
        sql`${sql.raw(dir)} NULLS LAST`,
      );
    }

    // All other properties: use text extraction
    return query.orderBy(
      sql.raw(`cells->>'${propertyId}'`),
      sql`${sql.raw(dir)} NULLS LAST`,
    );
  }
}
