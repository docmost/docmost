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
import { DuckDbRuntime } from './duckdb-runtime';
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

  /*
   * Serializes every write-path call into the shared writer connection.
   * DuckDB connections aren't thread-safe for concurrent prepared statements,
   * and Redis pub/sub can fire `applyChange` calls concurrently since the
   * subscriber's `pmessage` handler doesn't await. We funnel all writes
   * (`upsertRow`, `deleteRow`, `updatePosition`, `refreshRowCount`,
   * `invalidate`, `evictLru`) through this simple Promise chain so only
   * one is in flight at a time. Reads are unaffected — they flow through
   * the reader pool, which handles its own concurrency.
   */
  private writeQueue: Promise<void> = Promise.resolve();

  private async serializeWrite<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.writeQueue;
    let unblock!: () => void;
    this.writeQueue = new Promise<void>((resolve) => { unblock = resolve; });
    try {
      await prev;
      return await fn();
    } finally {
      unblock();
    }
  }

  constructor(
    private readonly configProvider: QueryCacheConfigProvider,
    private readonly baseRepo: BaseRepo,
    private readonly collectionLoader: CollectionLoader,
    private readonly runtime: DuckDbRuntime,
    @Optional() private readonly redisService: RedisService | null = null,
    @Optional() private readonly env: EnvironmentService | null = null,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { enabled, warmTopN } = this.configProvider.config;
    if (!enabled) return;
    if (!this.runtime.isReady()) {
      this.logger.warn('runtime not ready; skipping warm-up');
      return;
    }

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

  async onModuleDestroy(): Promise<void> {
    // The runtime owns the instance/connection lifecycle; we just clear
    // our metadata. DETACH is a no-op during shutdown because the instance
    // is closing anyway.
    this.collections.clear();
  }

  async list(
    baseId: string,
    workspaceId: string,
    opts: CacheListOpts,
  ): Promise<CursorPaginationResult<BaseRow>> {
    const debug = this.env?.getBaseQueryCacheDebug() ?? false;
    const trace = this.env?.getBaseQueryCacheTrace?.() ?? false;
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
      schema: collection.schema,
    });

    if (trace) {
      console.log(
        '[cache-trace]',
        JSON.stringify({
          phase: 'query.sql',
          baseId: baseId.slice(0, 8),
          schema: collection.schema,
          sql,
          params,
        }),
      );
    }

    const tExec = debug ? Date.now() : 0;
    const duckRows = await this.runtime.withReader(async (conn) => {
      const prepared = await conn.prepare(sql);
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
      return reader.getRowObjectsJS();
    });
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
      shapeBaseRow(r, collection.columns),
    );
    const shapeMs = debug ? Date.now() - tShape : 0;

    const endRow = duckRows[duckRows.length - 1];
    const startRow = duckRows[0];
    const encodeFromRow = (raw: Record<string, unknown>): string => {
      const entries: Array<[string, unknown]> = [];
      for (const sb of sortBuilds) entries.push([sb.key, raw[sb.key]]);
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
    await this.serializeWrite(async () => {
      await this.runtime.detachBase(collection.schema);
    });
    this.collections.delete(baseId);
  }

  isResident(baseId: string): boolean {
    return this.collections.has(baseId);
  }

  residentSize(): number {
    return this.collections.size;
  }

  peek(baseId: string): LoadedCollection | undefined {
    return this.collections.get(baseId);
  }

  residencySnapshot(): Array<{
    baseId: string;
    schema: string;
    rows: number;
    approxMb: number;
  }> {
    const out: Array<{
      baseId: string;
      schema: string;
      rows: number;
      approxMb: number;
    }> = [];
    for (const [baseId, c] of this.collections) {
      out.push({
        baseId,
        schema: c.schema,
        rows: c.rowCount,
        approxMb: +(c.approxBytes / (1024 * 1024)).toFixed(1),
      });
    }
    return out;
  }

  async applyChange(env: ChangeEnvelope): Promise<void> {
    const trace = this.env?.getBaseQueryCacheTrace?.() ?? false;
    const collection = this.collections.get(env.baseId);

    if (trace) {
      console.log(
        '[cache-trace]',
        JSON.stringify({
          phase: 'pubsub.apply',
          baseId: env.baseId.slice(0, 8),
          kind: env.kind,
          resident: !!collection,
        }),
      );
    }

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

  private async ensureLoaded(
    baseId: string,
    workspaceId: string,
  ): Promise<LoadedCollection> {
    const debug = this.env?.getBaseQueryCacheDebug() ?? false;
    const existing = this.collections.get(baseId);

    const tFind = debug ? Date.now() : 0;
    const base = await this.baseRepo.findById(baseId);
    const findMs = debug ? Date.now() - tFind : 0;
    if (!base) throw new Error(`Base ${baseId} not found`);
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
      await this.serializeWrite(async () => {
        await this.runtime.detachBase(existing.schema);
      });
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
          await this.evictLru();
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
          rows: loaded.rowCount,
          approxMb: +(loaded.approxBytes / (1024 * 1024)).toFixed(1),
        }),
      );
    }
    return loaded;
  }

  private async evictLru(): Promise<void> {
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
      await this.serializeWrite(async () => {
        await this.runtime.detachBase(col.schema);
      });
      this.collections.delete(oldestKey);
      this.logger.debug(`Evicted LRU collection ${oldestKey}`);
    }
  }

  private async upsertRow(
    collection: LoadedCollection,
    row: Record<string, unknown>,
  ): Promise<void> {
    return this.serializeWrite(async () => {
      const specs = collection.columns;
      const columnList = specs.map((s) => quoteIdent(s.column)).join(', ');
      const placeholders = specs.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO ${collection.schema}.rows (${columnList}) VALUES (${placeholders})`;

      const writer = this.runtime.getWriter();
      const prepared = await writer.prepare(sql);
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
    });
  }

  private async deleteRow(
    collection: LoadedCollection,
    rowId: string,
  ): Promise<void> {
    return this.serializeWrite(async () => {
      const writer = this.runtime.getWriter();
      const prepared = await writer.prepare(
        `DELETE FROM ${collection.schema}.rows WHERE id = ?`,
      );
      prepared.bindVarchar(1, rowId);
      await prepared.run();
    });
  }

  private async updatePosition(
    collection: LoadedCollection,
    rowId: string,
    position: string,
  ): Promise<void> {
    return this.serializeWrite(async () => {
      const writer = this.runtime.getWriter();
      const prepared = await writer.prepare(
        `UPDATE ${collection.schema}.rows SET position = ? WHERE id = ?`,
      );
      prepared.bindVarchar(1, position);
      prepared.bindVarchar(2, rowId);
      await prepared.run();
    });
  }

  private async refreshRowCount(collection: LoadedCollection): Promise<void> {
    return this.serializeWrite(async () => {
      try {
        const res = await this.runtime.getWriter().runAndReadAll(
          `SELECT count(*) AS c FROM ${collection.schema}.rows`,
        );
        const row = res.getRowObjects()[0] as { c: bigint | number };
        collection.rowCount = Number(row.c);
        collection.approxBytes = collection.rowCount * collection.columns.length * 64;
      } catch {
        // stale rowCount self-corrects on next reload
      }
    });
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

  private tryGetRedisClient(): Redis | null {
    if (!this.redisService) return null;
    try {
      return this.redisService.getOrNil();
    } catch {
      return null;
    }
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/*
 * Convert a DuckDB row object back to the BaseRow JSON shape returned to
 * API callers. Kept inline (not exported) because it's a pure derivation
 * from the ColumnSpec list.
 */
function shapeBaseRow(
  raw: Record<string, unknown>,
  specs: ColumnSpec[],
): BaseRow {
  const cells: Record<string, unknown> = {};
  for (const spec of specs) {
    if (!spec.property) continue;
    const val = raw[spec.column];
    if (val == null) continue;
    if (spec.ddlType === 'JSON' && typeof val === 'string') {
      try {
        cells[spec.property.id] = JSON.parse(val);
      } catch {
        cells[spec.property.id] = val;
      }
    } else {
      cells[spec.property.id] = val;
    }
  }
  return {
    id: raw.id as string,
    baseId: raw.base_id as string,
    workspaceId: raw.workspace_id as string,
    creatorId: raw.creator_id as string,
    position: raw.position as string,
    createdAt: coerceDate(raw.created_at),
    updatedAt: coerceDate(raw.updated_at),
    lastUpdatedById: raw.last_updated_by_id as string,
    deletedAt: null,
    cells,
  } as BaseRow;
}

function coerceDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === 'string') return new Date(v);
  return new Date(0);
}

function readFromRowEvent(
  row: Record<string, unknown>,
  spec: ColumnSpec,
): unknown {
  switch (spec.column) {
    case 'id':                 return row.id ?? null;
    case 'base_id':            return row.baseId ?? row.base_id ?? null;
    case 'workspace_id':       return row.workspaceId ?? row.workspace_id ?? null;
    case 'creator_id':         return row.creatorId ?? row.creator_id ?? null;
    case 'position':           return row.position ?? null;
    case 'created_at':         return row.createdAt ?? row.created_at ?? null;
    case 'updated_at':         return row.updatedAt ?? row.updated_at ?? null;
    case 'last_updated_by_id': return row.lastUpdatedById ?? row.last_updated_by_id ?? null;
    case 'deleted_at':         return null;
    case 'search_text':        return '';
  }
  const prop = spec.property;
  if (!prop) return null;
  if (
    prop.type === BasePropertyType.CREATED_AT ||
    prop.type === BasePropertyType.LAST_EDITED_AT ||
    prop.type === BasePropertyType.LAST_EDITED_BY
  ) {
    return null;
  }
  const cells = (row.cells as Record<string, unknown> | null) ?? {};
  return cells[prop.id] ?? null;
}
