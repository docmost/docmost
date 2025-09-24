// adapted from https://github.com/charlie-hadden/kysely-paginate/blob/main/src/offset.ts - MIT
import { SelectQueryBuilder, StringReference, sql } from 'kysely';

export type PaginationMeta = {
  limit: number;
  page: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};
export type PaginationResult<T> = {
  items: T[];
  meta: PaginationMeta;
};

export async function executeWithPagination<O, DB, TB extends keyof DB>(
  qb: SelectQueryBuilder<DB, TB, O>,
  opts: {
    perPage: number;
    page: number;
    experimental_deferredJoinPrimaryKey?: StringReference<DB, TB>;
    hasEmptyIds?: boolean; // in cases where we pass empty whereIn ids
  },
): Promise<PaginationResult<O>> {
  if (opts.page < 1) {
    opts.page = 1;
  }
  qb = qb.limit(opts.perPage + 1).offset((opts.page - 1) * opts.perPage);

  const deferredJoinPrimaryKey = opts.experimental_deferredJoinPrimaryKey;

  if (deferredJoinPrimaryKey) {
    const primaryKeys = await qb
      .clearSelect()
      .select((eb) => eb.ref(deferredJoinPrimaryKey).as('primaryKey'))
      .execute()
      // @ts-expect-error TODO: Fix the type here later

      .then((rows) => rows.map((row) => row.primaryKey));

    qb = qb
      .where((eb) =>
        primaryKeys.length > 0
          ? eb(deferredJoinPrimaryKey, 'in', primaryKeys as any)
          : eb(sql`1`, '=', 0),
      )
      .clearOffset()
      .clearLimit();
  }

  const rows = opts.hasEmptyIds ? [] : await qb.execute();
  const hasNextPage = rows.length > 0 ? rows.length > opts.perPage : false;
  const hasPrevPage = rows.length > 0 ? opts.page > 1 : false;

  // If we fetched an extra row to determine if we have a next page, that
  // shouldn't be in the returned results
  if (rows.length > opts.perPage) {
    rows.pop();
  }

  return {
    items: rows,
    meta: {
      limit: opts.perPage,
      page: opts.page,
      hasNextPage,
      hasPrevPage,
    },
  };
}
