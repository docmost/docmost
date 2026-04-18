import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  BaseRow,
  InsertableBaseRow,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  CursorPaginationResult,
  executeWithCursorPagination,
} from '@docmost/db/pagination/cursor-pagination';
import { sql, SqlBool } from 'kysely';
import {
  FilterNode,
  PropertySchema,
  SearchSpec,
  SortSpec,
  runListQuery,
} from '../../../core/base/engine';

type RepoOpts = { trx?: KyselyTransaction };
type WorkspaceOpts = { workspaceId: string } & RepoOpts;

// Columns that make up the public `BaseRow` shape.
// `search_text` and `search_tsv` are internal fulltext-index columns
// maintained by a trigger — they must never leak into API responses or
// socket payloads. Every SELECT/RETURNING path in this repo references
// this constant.
const BASE_ROW_COLUMNS = [
  'id',
  'baseId',
  'cells',
  'position',
  'creatorId',
  'lastUpdatedById',
  'workspaceId',
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const;

@Injectable()
export class BaseRowRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    rowId: string,
    opts: WorkspaceOpts,
  ): Promise<BaseRow | undefined> {
    const db = dbOrTx(this.db, opts.trx);
    return (await db
      .selectFrom('baseRows')
      .select(BASE_ROW_COLUMNS)
      .where('id', '=', rowId)
      .where('workspaceId', '=', opts.workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()) as BaseRow | undefined;
  }

  async list(opts: {
    baseId: string;
    workspaceId: string;
    filter?: FilterNode;
    sorts?: SortSpec[];
    search?: SearchSpec;
    schema: PropertySchema;
    pagination: PaginationOptions;
    trx?: KyselyTransaction;
  }): Promise<CursorPaginationResult<BaseRow>> {
    const db = dbOrTx(this.db, opts.trx);

    const base = db
      .selectFrom('baseRows')
      .select(BASE_ROW_COLUMNS)
      .where('baseId', '=', opts.baseId)
      .where('workspaceId', '=', opts.workspaceId)
      .where('deletedAt', 'is', null);

    const hasFilterSortSearch =
      !!opts.filter || (opts.sorts && opts.sorts.length > 0) || !!opts.search;

    if (!hasFilterSortSearch) {
      // Fast path: keyset-paginated list ordered by (position COLLATE "C", id)
      // to match idx_base_rows_base_alive. Without the collation hint the
      // planner falls back to a Sort node on every page.
      return executeWithCursorPagination(base as any, {
        perPage: opts.pagination.limit,
        cursor: opts.pagination.cursor,
        beforeCursor: opts.pagination.beforeCursor,
        fields: [
          {
            expression: sql`position COLLATE "C"`,
            direction: 'asc',
            key: 'position',
          },
          { expression: 'id', direction: 'asc', key: 'id' },
        ],
        parseCursor: (c) => ({
          position: c.position,
          id: c.id,
        }),
      } as any) as unknown as Promise<CursorPaginationResult<BaseRow>>;
    }

    return runListQuery(base as any, {
      filter: opts.filter,
      sorts: opts.sorts,
      search: opts.search,
      schema: opts.schema,
      pagination: opts.pagination,
    });
  }

  async getLastPosition(
    baseId: string,
    opts: WorkspaceOpts,
  ): Promise<string | null> {
    const db = dbOrTx(this.db, opts.trx);
    const result = await db
      .selectFrom('baseRows')
      .select('position')
      .where('baseId', '=', baseId)
      .where('workspaceId', '=', opts.workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy(sql`position COLLATE "C"`, 'desc')
      .limit(1)
      .executeTakeFirst();
    return result?.position ?? null;
  }

  async insertRow(
    row: InsertableBaseRow,
    opts?: RepoOpts,
  ): Promise<BaseRow> {
    const db = dbOrTx(this.db, opts?.trx);
    return (await db
      .insertInto('baseRows')
      .values(row)
      .returning(BASE_ROW_COLUMNS)
      .executeTakeFirstOrThrow()) as BaseRow;
  }

  /*
   * Merges `patch` into the row's cells via `jsonb_set_many` and returns
   * the updated row (public columns only — search_text/search_tsv are
   * excluded from RETURNING). Single round-trip; replaces the old
   * "updateCells + findById" two-query dance.
   */
  async updateCells(
    rowId: string,
    patch: Record<string, unknown>,
    opts: {
      baseId: string;
      workspaceId: string;
      actorId?: string;
      trx?: KyselyTransaction;
    },
  ): Promise<BaseRow | undefined> {
    const db = dbOrTx(this.db, opts.trx);
    // Cast through text because postgres.js auto-detects a JSON-shaped
    // string as jsonb and re-encodes it, producing a jsonb *string* instead
    // of an object — which `jsonb_set_many` then treats as a no-op.
    const patchJson = JSON.stringify(patch);
    return (await db
      .updateTable('baseRows')
      .set({
        cells: sql`jsonb_set_many(cells, ${patchJson}::text::jsonb)`,
        updatedAt: new Date(),
        lastUpdatedById: opts.actorId ?? null,
      })
      .where('id', '=', rowId)
      .where('baseId', '=', opts.baseId)
      .where('workspaceId', '=', opts.workspaceId)
      .where('deletedAt', 'is', null)
      .returning(BASE_ROW_COLUMNS)
      .executeTakeFirst()) as BaseRow | undefined;
  }

  async updatePosition(
    rowId: string,
    position: string,
    opts: {
      baseId: string;
      workspaceId: string;
      trx?: KyselyTransaction;
    },
  ): Promise<void> {
    const db = dbOrTx(this.db, opts.trx);
    await db
      .updateTable('baseRows')
      .set({ position, updatedAt: new Date() })
      .where('id', '=', rowId)
      .where('baseId', '=', opts.baseId)
      .where('workspaceId', '=', opts.workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async softDelete(
    rowId: string,
    opts: {
      baseId: string;
      workspaceId: string;
      trx?: KyselyTransaction;
    },
  ): Promise<void> {
    const db = dbOrTx(this.db, opts.trx);
    await db
      .updateTable('baseRows')
      .set({ deletedAt: new Date() })
      .where('id', '=', rowId)
      .where('baseId', '=', opts.baseId)
      .where('workspaceId', '=', opts.workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async removeCellKey(
    baseId: string,
    propertyId: string,
    opts: WorkspaceOpts,
  ): Promise<void> {
    const db = dbOrTx(this.db, opts.trx);
    await db
      .updateTable('baseRows')
      .set({
        cells: sql`cells - ${propertyId}::text`,
        updatedAt: new Date(),
      })
      .where('baseId', '=', baseId)
      .where('workspaceId', '=', opts.workspaceId)
      .execute();
  }

  /*
   * Streams every live row of a base in deterministic order via keyset
   * pagination so async jobs (type-conversion, cell-gc, export) can process
   * large bases without loading the full set into memory.
   *
   * `withCellKey` restricts the scan to rows whose cell jsonb contains
   * that top-level key. Type-conversion callers pass the property ID so
   * we don't drag 100k empty rows through Node just to rewrite a dozen.
   */
  async *streamByBaseId(
    baseId: string,
    opts: {
      workspaceId: string;
      chunkSize?: number;
      trx?: KyselyTransaction;
      withCellKey?: string;
    },
  ): AsyncGenerator<BaseRow[], void, void> {
    const chunkSize = opts.chunkSize ?? 1000;
    const db = dbOrTx(this.db, opts.trx);
    let afterPosition: string | null = null;
    let afterId: string | null = null;

    while (true) {
      let qb = db
        .selectFrom('baseRows')
        .select(BASE_ROW_COLUMNS)
        .where('baseId', '=', baseId)
        .where('workspaceId', '=', opts.workspaceId)
        .where('deletedAt', 'is', null)
        .orderBy(sql`position COLLATE "C"`, 'asc')
        .orderBy('id', 'asc')
        .limit(chunkSize);

      if (opts.withCellKey) {
        qb = qb.where(sql<SqlBool>`cells ? ${opts.withCellKey}`);
      }

      if (afterPosition !== null && afterId !== null) {
        qb = qb.where((eb) =>
          eb.or([
            eb(sql`position COLLATE "C"`, '>', afterPosition!),
            eb.and([
              eb(sql`position COLLATE "C"`, '=', afterPosition!),
              eb('id', '>', afterId!),
            ]),
          ]),
        );
      }

      const chunk = (await qb.execute()) as BaseRow[];
      if (chunk.length === 0) return;
      yield chunk;
      if (chunk.length < chunkSize) return;
      const last = chunk[chunk.length - 1];
      afterPosition = last.position;
      afterId = last.id;
    }
  }

  /*
   * Real batch: one `UPDATE ... FROM (SELECT unnest($ids), unnest($patches))`
   * per call. Callers chunk (typically 1000 per call) from inside a BullMQ
   * job. `cells` is merged via `jsonb_set_many` so only touched subtrees
   * rewrite.
   */
  async batchUpdateCells(
    updates: Array<{ id: string; patch: Record<string, unknown> }>,
    opts: {
      baseId: string;
      workspaceId: string;
      actorId?: string;
      trx?: KyselyTransaction;
    },
  ): Promise<void> {
    if (updates.length === 0) return;
    const db = dbOrTx(this.db, opts.trx);

    const ids = updates.map((u) => u.id);
    const patches = updates.map((u) => JSON.stringify(u.patch));

    await sql`
      UPDATE base_rows AS r
      SET cells              = jsonb_set_many(r.cells, u.patch::jsonb),
          updated_at         = now(),
          last_updated_by_id = coalesce(${opts.actorId ?? null}, r.last_updated_by_id)
      FROM unnest(${ids}::uuid[], ${patches}::text[]) AS u(row_id, patch)
      WHERE r.id = u.row_id
        AND r.base_id = ${opts.baseId}
        AND r.workspace_id = ${opts.workspaceId}
        AND r.deleted_at IS NULL
    `.execute(db);
  }
}
