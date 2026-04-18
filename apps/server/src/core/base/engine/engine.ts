import { SelectQueryBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { BaseRow } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  CursorPaginationResult,
  executeWithCursorPagination,
} from '@docmost/db/pagination/cursor-pagination';
import { FilterNode, SearchSpec, SortSpec } from './schema.zod';
import { buildWhere, PropertySchema } from './predicate';
import { buildSorts, CURSOR_TAIL_KEYS, SortBuild } from './sort';
import { buildSearch } from './search';
import { makeCursor } from './cursor';

export type EngineListOpts = {
  filter?: FilterNode;
  sorts?: SortSpec[];
  search?: SearchSpec;
  schema: PropertySchema;
  pagination: PaginationOptions;
};

/*
 * Top-level orchestrator. Callers (repos, services) provide a base
 * Kysely query already scoped to the target base + workspace + alive
 * rows; this adds search/filter/sort clauses and runs cursor pagination.
 */
export async function runListQuery(
  base: SelectQueryBuilder<DB, 'baseRows', any>,
  opts: EngineListOpts,
): Promise<CursorPaginationResult<BaseRow>> {
  let qb = base;

  if (opts.search) {
    const spec = opts.search;
    qb = qb.where((eb) => buildSearch(eb, spec));
  }

  if (opts.filter) {
    const filter = opts.filter;
    qb = qb.where((eb) => buildWhere(eb, filter, opts.schema));
  }

  const sortBuilds: SortBuild[] =
    opts.sorts && opts.sorts.length > 0
      ? buildSorts(opts.sorts, opts.schema)
      : [];

  for (const sb of sortBuilds) {
    qb = qb.select(sb.expression.as(sb.key)) as SelectQueryBuilder<
      DB,
      'baseRows',
      any
    >;
  }

  const cursor = makeCursor(sortBuilds, CURSOR_TAIL_KEYS);

  const fields = [
    ...sortBuilds.map((sb) => ({
      expression: sb.expression,
      direction: sb.direction,
      key: sb.key,
    })),
    {
      expression: 'position' as const,
      direction: 'asc' as const,
      key: 'position' as const,
    },
    {
      expression: 'id' as const,
      direction: 'asc' as const,
      key: 'id' as const,
    },
  ];

  return executeWithCursorPagination(qb as any, {
    perPage: opts.pagination.limit,
    cursor: opts.pagination.cursor,
    beforeCursor: opts.pagination.beforeCursor,
    fields: fields as any,
    encodeCursor: cursor.encodeCursor as any,
    decodeCursor: cursor.decodeCursor as any,
    parseCursor: cursor.parseCursor as any,
  }) as unknown as Promise<CursorPaginationResult<BaseRow>>;
}
