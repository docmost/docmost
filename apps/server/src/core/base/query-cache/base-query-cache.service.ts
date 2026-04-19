import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { BaseRow } from '@docmost/db/types/entity.types';
import {
  CursorPaginationResult,
  emptyCursorPaginationResult,
} from '@docmost/db/pagination/cursor-pagination';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  CURSOR_TAIL_KEYS,
  FilterNode,
  PropertySchema,
  SearchSpec,
  SortBuild,
  SortSpec,
  buildSorts,
  makeCursor,
} from '../engine';
import { QueryCacheConfigProvider } from './query-cache.config';
import { CollectionLoader } from './collection-loader';
import { buildDuckDbListQuery } from './duckdb-query-builder';
import { ColumnSpec, LoadedCollection } from './query-cache.types';

export type CacheListOpts = {
  filter?: FilterNode;
  sorts?: SortSpec[];
  search?: SearchSpec;
  schema: PropertySchema;
  pagination: PaginationOptions;
};

@Injectable()
export class BaseQueryCacheService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BaseQueryCacheService.name);
  private readonly collections = new Map<string, LoadedCollection>();

  constructor(
    private readonly configProvider: QueryCacheConfigProvider,
    private readonly baseRepo: BaseRepo,
    private readonly collectionLoader: CollectionLoader,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { enabled } = this.configProvider.config;
    this.logger.log(
      `BaseQueryCacheService bootstrapped (enabled=${enabled}).`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    for (const [, collection] of this.collections) {
      this.closeCollection(collection);
    }
    this.collections.clear();
  }

  async list(
    baseId: string,
    workspaceId: string,
    opts: CacheListOpts,
  ): Promise<CursorPaginationResult<BaseRow>> {
    const collection = await this.ensureLoaded(baseId, workspaceId);

    const sortBuilds: SortBuild[] =
      opts.sorts && opts.sorts.length > 0
        ? buildSorts(opts.sorts, opts.schema)
        : [];

    const cursor = makeCursor(sortBuilds, CURSOR_TAIL_KEYS);

    const sortFieldKeys = sortBuilds.map((s) => s.key);
    const allFieldKeys = [...sortFieldKeys, 'position', 'id'];

    let afterKeys: Record<string, unknown> | undefined;
    if (opts.pagination.cursor) {
      const decoded = cursor.decodeCursor(opts.pagination.cursor, allFieldKeys);
      afterKeys = cursor.parseCursor(decoded);
    }

    const { sql, params } = buildDuckDbListQuery({
      columns: collection.columns,
      filter: opts.filter,
      sorts: opts.sorts,
      search: opts.search,
      pagination: {
        limit: opts.pagination.limit,
        afterKeys: afterKeys as any,
      },
    });

    const prepared = await collection.connection.prepare(sql);
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      const oneBased = i + 1;
      if (p === null || p === undefined) {
        prepared.bindNull(oneBased);
      } else if (typeof p === 'string') {
        prepared.bindVarchar(oneBased, p);
      } else if (typeof p === 'number') {
        prepared.bindDouble(oneBased, p);
      } else if (typeof p === 'boolean') {
        prepared.bindBoolean(oneBased, p);
      } else if (p instanceof Date) {
        prepared.bindVarchar(oneBased, p.toISOString());
      } else {
        prepared.bindVarchar(oneBased, JSON.stringify(p));
      }
    }

    const reader = await prepared.runAndReadAll();
    const duckRows = reader.getRowObjectsJS();

    const hasNextPage = duckRows.length > opts.pagination.limit;
    if (hasNextPage) duckRows.pop();

    if (duckRows.length === 0) {
      return emptyCursorPaginationResult<BaseRow>(opts.pagination.limit);
    }

    const items = duckRows.map((r) =>
      shapeBaseRow(r, collection.columns, sortBuilds),
    );

    const endRow = duckRows[duckRows.length - 1];
    const startRow = duckRows[0];

    const encodeFromRow = (raw: Record<string, unknown>): string => {
      const entries: Array<[string, unknown]> = [];
      for (const sb of sortBuilds) {
        entries.push([sb.key, raw[sb.key]]);
      }
      entries.push(['position', raw.position]);
      entries.push(['id', raw.id]);
      return cursor.encodeCursor(entries);
    };

    const hasPrevPage = !!opts.pagination.cursor;
    const nextCursor = hasNextPage ? encodeFromRow(endRow) : null;
    const prevCursor = hasPrevPage ? encodeFromRow(startRow) : null;

    return {
      items,
      meta: {
        limit: opts.pagination.limit,
        hasNextPage,
        hasPrevPage,
        nextCursor,
        prevCursor,
      },
    };
  }

  async invalidate(baseId: string): Promise<void> {
    const collection = this.collections.get(baseId);
    if (!collection) return;
    this.closeCollection(collection);
    this.collections.delete(baseId);
  }

  private async ensureLoaded(
    baseId: string,
    workspaceId: string,
  ): Promise<LoadedCollection> {
    const existing = this.collections.get(baseId);

    const base = await this.baseRepo.findById(baseId);
    if (!base) {
      throw new Error(`Base ${baseId} not found`);
    }
    const freshVersion = (base as any).schemaVersion ?? 1;

    if (existing && existing.schemaVersion === freshVersion) {
      existing.lastAccessedAt = Date.now();
      return existing;
    }

    if (existing) {
      this.closeCollection(existing);
      this.collections.delete(baseId);
    }

    const { maxCollections } = this.configProvider.config;
    if (this.collections.size >= maxCollections) {
      this.evictLru();
    }

    const loaded = await this.collectionLoader.load(baseId, workspaceId);
    this.collections.set(baseId, loaded);
    return loaded;
  }

  private evictLru(): void {
    let oldestKey: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;
    for (const [key, col] of this.collections) {
      if (col.lastAccessedAt < oldestTime) {
        oldestTime = col.lastAccessedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const col = this.collections.get(oldestKey)!;
      this.closeCollection(col);
      this.collections.delete(oldestKey);
      this.logger.debug(`Evicted LRU collection ${oldestKey}`);
    }
  }

  private closeCollection(collection: LoadedCollection): void {
    try {
      collection.connection.closeSync();
    } catch (err) {
      this.logger.warn(`Failed to close connection: ${(err as Error).message}`);
    }
    try {
      collection.instance.closeSync();
    } catch (err) {
      this.logger.warn(`Failed to close instance: ${(err as Error).message}`);
    }
  }
}

// Convert a DuckDB row object back into the BaseRow JSON shape. The builder
// projects `cells` as a json_object keyed by property id; typed columns
// (DOUBLE, BOOLEAN, TIMESTAMPTZ) round-trip as JS primitives / Date objects.
// We reconstruct `cells` directly from the per-property columns so the JSON
// payload matches what Postgres returns.
function shapeBaseRow(
  raw: Record<string, unknown>,
  specs: ColumnSpec[],
  _sortBuilds: SortBuild[],
): BaseRow {
  const cells: Record<string, unknown> = {};
  for (const spec of specs) {
    if (!spec.property) continue; // system columns handled below
    const v = raw[spec.column];
    cells[spec.property.id] = normaliseCellValue(v, spec);
  }

  return {
    id: String(raw.id),
    baseId: String(raw.base_id),
    cells: cells as any,
    position: String(raw.position),
    creatorId: raw.creator_id == null ? null : String(raw.creator_id),
    lastUpdatedById:
      raw.last_updated_by_id == null ? null : String(raw.last_updated_by_id),
    workspaceId: String(raw.workspace_id),
    createdAt: toDate(raw.created_at),
    updatedAt: toDate(raw.updated_at),
    deletedAt: raw.deleted_at == null ? null : toDate(raw.deleted_at),
  } as BaseRow;
}

function normaliseCellValue(value: unknown, spec: ColumnSpec): unknown {
  if (value == null) return null;
  switch (spec.ddlType) {
    case 'VARCHAR':
      return String(value);
    case 'DOUBLE':
      return typeof value === 'number' ? value : Number(value);
    case 'BOOLEAN':
      return Boolean(value);
    case 'TIMESTAMPTZ': {
      if (value instanceof Date) return value.toISOString();
      return String(value);
    }
    case 'JSON': {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    }
    default:
      return value;
  }
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  return new Date(String(value));
}
