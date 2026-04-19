import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';
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
import { BasePropertyType } from '../base.schemas';
import {
  ChangeEnvelope,
  ColumnSpec,
  LoadedCollection,
} from './query-cache.types';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

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
  private readonly inFlightLoads = new Map<string, Promise<LoadedCollection>>();

  constructor(
    private readonly configProvider: QueryCacheConfigProvider,
    private readonly baseRepo: BaseRepo,
    private readonly collectionLoader: CollectionLoader,
    @Optional() private readonly redisService: RedisService | null = null,
    @Optional() private readonly env: EnvironmentService | null = null,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { enabled, warmTopN } = this.configProvider.config;
    if (!enabled) return;
    const redis = this.tryGetRedisClient();
    if (!redis) return;
    try {
      const ids = await redis.zrevrange(
        'base-query-cache:recent',
        0,
        warmTopN - 1,
      );
      for (const baseId of ids) {
        try {
          const base = await this.baseRepo.findById(baseId);
          if (!base) continue;
          await this.ensureLoaded(baseId, base.workspaceId);
        } catch (err) {
          this.logger.debug(
            `warm-up skipped ${baseId}: ${(err as Error).message}`,
          );
        }
      }
      this.logger.log(`Warmed ${ids.length} collections on boot`);
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Warm-up failed: ${error.message}`);
      if (error.stack) this.logger.warn(error.stack);
    }
  }

  private tryGetRedisClient(): Redis | null {
    if (!this.redisService) return null;
    try {
      return this.redisService.getOrNil();
    } catch {
      return null;
    }
  }

  private recordAccess(baseId: string): void {
    if (!this.configProvider.config.enabled) return;
    const redis = this.tryGetRedisClient();
    if (!redis) return;
    const nowMs = Date.now();
    const maxKeep = this.configProvider.config.maxCollections * 10;
    void (async () => {
      try {
        await redis.zadd('base-query-cache:recent', nowMs, baseId);
        await redis.zremrangebyrank(
          'base-query-cache:recent',
          0,
          -(maxKeep + 1),
        );
      } catch (err) {
        this.logger.debug(
          `recordAccess failed for ${baseId}: ${(err as Error).message}`,
        );
      }
    })();
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
    const debug = this.env?.getBaseQueryCacheDebug() ?? false;
    const tStart = debug ? Date.now() : 0;

    const tEnsure = debug ? Date.now() : 0;
    const collection = await this.ensureLoaded(baseId, workspaceId);
    const ensureMs = debug ? Date.now() - tEnsure : 0;

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

    const tExec = debug ? Date.now() : 0;
    const reader = await prepared.runAndReadAll();
    const duckRows = reader.getRowObjectsJS();
    const execMs = debug ? Date.now() - tExec : 0;

    const hasNextPage = duckRows.length > opts.pagination.limit;
    if (hasNextPage) duckRows.pop();

    if (duckRows.length === 0) {
      if (debug) {
        console.log(
          '[cache-perf]',
          JSON.stringify({
            phase: 'cache.list',
            baseId: baseId.slice(0, 8),
            totalMs: Date.now() - tStart,
            ensureMs,
            execMs,
            shapeMs: 0,
            rows: 0,
          }),
        );
      }
      return emptyCursorPaginationResult<BaseRow>(opts.pagination.limit);
    }

    const tShape = debug ? Date.now() : 0;
    const items = duckRows.map((r) =>
      shapeBaseRow(r, collection.columns, sortBuilds),
    );
    const shapeMs = debug ? Date.now() - tShape : 0;

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

    if (debug) {
      console.log(
        '[cache-perf]',
        JSON.stringify({
          phase: 'cache.list',
          baseId: baseId.slice(0, 8),
          totalMs: Date.now() - tStart,
          ensureMs,
          execMs,
          shapeMs,
          rows: items.length,
        }),
      );
    }

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

  // Test-only introspection of the resident cache. Used by the LRU eviction
  // integration spec to assert which collections are currently loaded without
  // reaching into the private `collections` map.
  isResident(baseId: string): boolean {
    return this.collections.has(baseId);
  }

  residentSize(): number {
    return this.collections.size;
  }

  // Production-facing fast path for the router: returns the resident
  // collection without triggering a load. Used to avoid a per-request
  // Postgres COUNT when the cached rowCount already answers the question.
  peek(baseId: string): LoadedCollection | undefined {
    return this.collections.get(baseId);
  }

  /*
   * Apply a change envelope received from Redis pub/sub to the local
   * collection (if any). Rows that target bases not resident on this node
   * are ignored — the next `list` call will load them fresh from Postgres.
   * If any patch step throws (e.g. schema drift between this node and the
   * publisher) we eagerly invalidate so the next `list` rebuilds cleanly
   * rather than serving partial state.
   */
  async applyChange(env: ChangeEnvelope): Promise<void> {
    const collection = this.collections.get(env.baseId);
    if (!collection) return;

    try {
      switch (env.kind) {
        case 'schema-invalidate':
          if (env.schemaVersion > collection.schemaVersion) {
            await this.invalidate(env.baseId);
          }
          return;
        case 'row-upsert':
          await this.upsertRow(collection, env.row);
          await this.refreshRowCount(collection);
          return;
        case 'row-delete':
          await this.deleteRow(collection, env.rowId);
          await this.refreshRowCount(collection);
          return;
        case 'rows-delete':
          for (const id of env.rowIds) await this.deleteRow(collection, id);
          await this.refreshRowCount(collection);
          return;
        case 'row-reorder':
          await this.updatePosition(collection, env.rowId, env.position);
          return;
      }
    } catch (err) {
      const error = err as Error;
      this.logger.warn(
        `applyChange failed for ${env.baseId}; invalidating: ${error.message}`,
      );
      if (error.stack) this.logger.warn(error.stack);
      await this.invalidate(env.baseId);
    }
  }

  private async refreshRowCount(collection: LoadedCollection): Promise<void> {
    try {
      const res = await collection.connection.runAndReadAll(
        'SELECT count(*) AS c FROM rows',
      );
      const row = res.getRowObjects()[0] as { c: bigint | number };
      collection.rowCount = Number(row.c);
    } catch {
      // swallow — stale rowCount drifts at most by the size of the burst; the
      // next reload-from-Postgres or pubsub event corrects it.
    }
  }

  private async upsertRow(
    collection: LoadedCollection,
    row: Record<string, unknown>,
  ): Promise<void> {
    const specs = collection.columns;
    const columnList = specs.map((s) => quoteIdent(s.column)).join(', ');
    const placeholders = specs.map(() => '?').join(', ');
    const sql = `INSERT OR REPLACE INTO rows (${columnList}) VALUES (${placeholders})`;

    const prepared = await collection.connection.prepare(sql);
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const oneBased = i + 1;
      const raw = readFromRowEvent(row, spec);
      if (raw == null) {
        prepared.bindNull(oneBased);
        continue;
      }
      switch (spec.ddlType) {
        case 'VARCHAR':
          prepared.bindVarchar(oneBased, String(raw));
          break;
        case 'DOUBLE': {
          const n = Number(raw);
          if (Number.isNaN(n)) prepared.bindNull(oneBased);
          else prepared.bindDouble(oneBased, n);
          break;
        }
        case 'BOOLEAN':
          prepared.bindBoolean(oneBased, Boolean(raw));
          break;
        case 'TIMESTAMPTZ': {
          const d = raw instanceof Date ? raw : new Date(String(raw));
          if (Number.isNaN(d.getTime())) prepared.bindNull(oneBased);
          else prepared.bindVarchar(oneBased, d.toISOString());
          break;
        }
        case 'JSON':
          prepared.bindVarchar(oneBased, JSON.stringify(raw));
          break;
      }
    }
    await prepared.run();
  }

  private async deleteRow(
    collection: LoadedCollection,
    rowId: string,
  ): Promise<void> {
    const prepared = await collection.connection.prepare(
      'DELETE FROM rows WHERE id = ?',
    );
    prepared.bindVarchar(1, rowId);
    await prepared.run();
  }

  private async updatePosition(
    collection: LoadedCollection,
    rowId: string,
    position: string,
  ): Promise<void> {
    const prepared = await collection.connection.prepare(
      'UPDATE rows SET position = ? WHERE id = ?',
    );
    prepared.bindVarchar(1, position);
    prepared.bindVarchar(2, rowId);
    await prepared.run();
  }

  private async ensureLoaded(
    baseId: string,
    workspaceId: string,
  ): Promise<LoadedCollection> {
    const debug = this.env?.getBaseQueryCacheDebug() ?? false;
    // TODO(task-7): remove per-request findById once pub/sub invalidation
    // keeps collections in sync with schema bumps.
    const existing = this.collections.get(baseId);

    const tFind = debug ? Date.now() : 0;
    const base = await this.baseRepo.findById(baseId);
    const findMs = debug ? Date.now() - tFind : 0;
    if (!base) {
      throw new Error(`Base ${baseId} not found`);
    }
    const freshVersion = (base as any).schemaVersion ?? 1;

    if (existing && existing.schemaVersion === freshVersion) {
      existing.lastAccessedAt = Date.now();
      this.recordAccess(baseId);
      if (debug) {
        console.log(
          '[cache-perf]',
          JSON.stringify({
            phase: 'ensureLoaded.hit',
            baseId: baseId.slice(0, 8),
            findMs,
          }),
        );
      }
      return existing;
    }

    if (existing) {
      this.closeCollection(existing);
      this.collections.delete(baseId);
    }

    const inFlight = this.inFlightLoads.get(baseId);
    if (inFlight) {
      const loaded = await inFlight;
      this.recordAccess(baseId);
      return loaded;
    }

    const tLoad = debug ? Date.now() : 0;
    const promise = (async () => {
      try {
        const { maxCollections } = this.configProvider.config;
        if (this.collections.size >= maxCollections) {
          this.evictLru();
        }
        const loaded = await this.collectionLoader.load(baseId, workspaceId);
        this.collections.set(baseId, loaded);
        return loaded;
      } finally {
        this.inFlightLoads.delete(baseId);
      }
    })();
    this.inFlightLoads.set(baseId, promise);
    const loaded = await promise;
    const loadMs = debug ? Date.now() - tLoad : 0;
    this.recordAccess(baseId);
    if (debug) {
      console.log(
        '[cache-perf]',
        JSON.stringify({
          phase: 'ensureLoaded.miss',
          baseId: baseId.slice(0, 8),
          findMs,
          loadMs,
        }),
      );
    }
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
// projects one column per user property; typed columns (DOUBLE, BOOLEAN,
// TIMESTAMPTZ) round-trip as JS primitives / Date objects. We reconstruct
// `cells` directly from the per-property columns so the JSON payload matches
// what Postgres returns.
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

// System property type → system column on base_rows (mirrors the map in
// collection-loader.ts). Kept local to avoid a circular import.
const SYSTEM_PROPERTY_COLUMN_LOOKUP: Record<string, string> = {
  [BasePropertyType.CREATED_AT]: 'createdAt',
  [BasePropertyType.LAST_EDITED_AT]: 'updatedAt',
  [BasePropertyType.LAST_EDITED_BY]: 'lastUpdatedById',
};

// Mirror of collection-loader's `readFromRow`, but keyed off a generic event
// payload (which may be camelCase JSON because it came over EventEmitter /
// Redis rather than straight from Kysely — both shapes round-trip through
// here). The function tolerates both the wire shape and the repo shape.
function readFromRowEvent(
  row: Record<string, unknown>,
  spec: ColumnSpec,
): unknown {
  switch (spec.column) {
    case 'id':
      return row.id;
    case 'base_id':
      return row.baseId ?? row.base_id;
    case 'workspace_id':
      return row.workspaceId ?? row.workspace_id;
    case 'creator_id':
      return row.creatorId ?? row.creator_id;
    case 'position':
      return row.position;
    case 'created_at':
      return row.createdAt ?? row.created_at;
    case 'updated_at':
      return row.updatedAt ?? row.updated_at;
    case 'last_updated_by_id':
      return row.lastUpdatedById ?? row.last_updated_by_id;
    case 'deleted_at':
      return null;
    case 'search_text':
      return '';
  }

  const prop = spec.property;
  if (!prop) return null;

  const sysColumn = SYSTEM_PROPERTY_COLUMN_LOOKUP[prop.type];
  if (sysColumn) return row[sysColumn] ?? null;

  const cells = (row.cells as Record<string, unknown> | null) ?? {};
  return cells[prop.id] ?? null;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
