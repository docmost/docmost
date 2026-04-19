import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { KyselyModule, InjectKysely } from 'nestjs-kysely';
import { CamelCasePlugin, sql } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import * as postgres from 'postgres';
import { Injectable } from '@nestjs/common';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '@nestjs-labs/nestjs-ioredis';
import Redis from 'ioredis';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { BaseViewRepo } from '@docmost/db/repos/base/base-view.repo';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BaseQueryCacheService } from './base-query-cache.service';
import { QueryCacheConfigProvider } from './query-cache.config';
import { CollectionLoader } from './collection-loader';
import { BaseQueryCacheWriteConsumer } from './base-query-cache.write-consumer';
import { BaseQueryCacheSubscriber } from './base-query-cache.subscriber';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { seedBase, deleteSeededBase } from './testing/seed-base';
import { PropertySchema } from '../engine';
import { EventName } from '../../../common/events/event.contants';
import { BaseRowUpdatedEvent } from '../events/base-events';
import { ChangeEnvelope } from './query-cache.types';

const INTEGRATION_DB_URL = process.env.INTEGRATION_DB_URL;
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Minimal EnvironmentService stand-in that only implements the methods used
// by query-cache and the repos we touch.
@Injectable()
class FakeEnvService {
  getDatabaseURL() {
    return INTEGRATION_DB_URL!;
  }
  getDatabaseMaxPool() {
    return 5;
  }
  getNodeEnv() {
    return 'test';
  }
  getBaseQueryCacheEnabled() {
    return true;
  }
  getBaseQueryCacheMinRows() {
    return 100;
  }
  getBaseQueryCacheMaxCollections() {
    return 10;
  }
  getBaseQueryCacheWarmTopN() {
    return 0;
  }
  getRedisUrl() {
    return REDIS_URL;
  }
}

@Injectable()
class DbHandle {
  constructor(@InjectKysely() readonly db: KyselyDB) {}
}

function normalizePostgresUrl(url: string): string {
  const parsed = new URL(url);
  const newParams = new URLSearchParams();
  for (const [key, value] of parsed.searchParams) {
    if (key === 'sslmode' && value === 'no-verify') continue;
    if (key === 'schema') continue;
    newParams.append(key, value);
  }
  parsed.search = newParams.toString();
  return parsed.toString();
}

const describeIntegration = INTEGRATION_DB_URL ? describe : describe.skip;

async function isRedisReachable(): Promise<boolean> {
  const probe = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  try {
    await probe.connect();
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

describeIntegration('BaseQueryCacheService LRU eviction', () => {
  @Injectable()
  class TinyCapEnvService {
    getDatabaseURL() {
      return INTEGRATION_DB_URL!;
    }
    getDatabaseMaxPool() {
      return 5;
    }
    getNodeEnv() {
      return 'test';
    }
    getBaseQueryCacheEnabled() {
      return true;
    }
    getBaseQueryCacheMinRows() {
      return 1;
    }
    getBaseQueryCacheMaxCollections() {
      return 2;
    }
    getBaseQueryCacheWarmTopN() {
      return 0;
    }
    getRedisUrl() {
      return REDIS_URL;
    }
  }

  let moduleRef: TestingModule;
  let cache: BaseQueryCacheService;
  let basePropertyRepo: BasePropertyRepo;
  let dbHandle: DbHandle;
  let workspaceId: string;
  let spaceId: string;
  let creatorUserId: string | null;
  const seededBaseIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = INTEGRATION_DB_URL;

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        KyselyModule.forRoot({
          dialect: new PostgresJSDialect({
            postgres: (postgres as any)(
              normalizePostgresUrl(INTEGRATION_DB_URL!),
              {
                max: 5,
                onnotice: () => {},
                types: {
                  bigint: {
                    to: 20,
                    from: [20, 1700],
                    serialize: (value: number) => value.toString(),
                    parse: (value: string) => Number.parseInt(value),
                  },
                },
              },
            ),
          }),
          plugins: [new CamelCasePlugin()],
        }),
        EventEmitterModule.forRoot(),
      ],
      providers: [
        { provide: EnvironmentService, useClass: TinyCapEnvService },
        QueryCacheConfigProvider,
        BaseRepo,
        BasePropertyRepo,
        BaseRowRepo,
        BaseViewRepo,
        CollectionLoader,
        BaseQueryCacheService,
        DbHandle,
      ],
    }).compile();

    cache = moduleRef.get(BaseQueryCacheService);
    basePropertyRepo = moduleRef.get(BasePropertyRepo);
    dbHandle = moduleRef.get(DbHandle);

    const workspace = await dbHandle.db
      .selectFrom('workspaces')
      .select(['id'])
      .limit(1)
      .executeTakeFirstOrThrow();
    workspaceId = workspace.id;

    const space = await dbHandle.db
      .selectFrom('spaces')
      .select(['id'])
      .where('workspaceId', '=', workspaceId)
      .limit(1)
      .executeTakeFirstOrThrow();
    spaceId = space.id;

    const user = await dbHandle.db
      .selectFrom('users')
      .select('id')
      .limit(1)
      .executeTakeFirst();
    creatorUserId = user?.id ?? null;

    for (let i = 0; i < 3; i++) {
      const { baseId } = await seedBase({
        db: dbHandle.db as any,
        workspaceId,
        spaceId,
        creatorUserId,
        rows: 100,
        name: `cache-evict-${i}-${Date.now()}`,
      });
      seededBaseIds.push(baseId);
    }
  }, 120_000);

  afterAll(async () => {
    for (const id of seededBaseIds) {
      await deleteSeededBase(dbHandle.db as any, id);
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  }, 60_000);

  it(
    'evicts the least-recently-used collection when maxCollections is exceeded',
    async () => {
      const [firstId, secondId, thirdId] = seededBaseIds;

      const loadOnce = async (baseId: string) => {
        const properties = await basePropertyRepo.findByBaseId(baseId);
        const schema: PropertySchema = new Map(
          properties.map((p) => [p.id, p]),
        );
        const estimateProp = properties.find((p) => p.name === 'Estimate');
        if (!estimateProp) throw new Error('Estimate property not found');
        // Route through ensureLoaded via a query that uses the cache path.
        const page = await cache.list(baseId, workspaceId, {
          sorts: [{ propertyId: estimateProp.id, direction: 'asc' }],
          schema,
          pagination: { limit: 10 } as any,
        });
        return page;
      };

      await loadOnce(firstId);
      // Small delay so lastAccessedAt differs across loads and LRU is deterministic.
      await new Promise((r) => setTimeout(r, 5));
      await loadOnce(secondId);
      await new Promise((r) => setTimeout(r, 5));
      await loadOnce(thirdId);

      expect(cache.residentSize()).toBe(2);
      expect(cache.isResident(firstId)).toBe(false);
      expect(cache.isResident(secondId)).toBe(true);
      expect(cache.isResident(thirdId)).toBe(true);

      // Reload the evicted base — should rebuild cleanly.
      const reloaded = await loadOnce(firstId);
      expect(reloaded.items.length).toBeGreaterThan(0);
      expect(cache.residentSize()).toBe(2);
      expect(cache.isResident(firstId)).toBe(true);
      // The least-recently-accessed of the two survivors (secondId) should
      // now be the one evicted.
      expect(cache.isResident(secondId)).toBe(false);
      expect(cache.isResident(thirdId)).toBe(true);
    },
    60_000,
  );
});

describeIntegration('BaseQueryCacheService integration', () => {
  let moduleRef: TestingModule;
  let cache: BaseQueryCacheService;
  let baseRowRepo: BaseRowRepo;
  let basePropertyRepo: BasePropertyRepo;
  let dbHandle: DbHandle;
  let eventEmitter: EventEmitter2;
  let seededBaseId: string | null = null;
  let workspaceId: string;
  let spaceId: string;
  let creatorUserId: string | null;
  let redisReachable = false;

  beforeAll(async () => {
    process.env.DATABASE_URL = INTEGRATION_DB_URL;
    process.env.REDIS_URL = REDIS_URL;
    process.env.BASE_QUERY_CACHE_ENABLED = 'true';
    process.env.BASE_QUERY_CACHE_MIN_ROWS = '100';

    redisReachable = await isRedisReachable();

    const imports: any[] = [
      ConfigModule.forRoot({ isGlobal: true }),
      KyselyModule.forRoot({
        dialect: new PostgresJSDialect({
          postgres: (postgres as any)(
            normalizePostgresUrl(INTEGRATION_DB_URL!),
            {
              max: 5,
              onnotice: () => {},
              types: {
                bigint: {
                  to: 20,
                  from: [20, 1700],
                  serialize: (value: number) => value.toString(),
                  parse: (value: string) => Number.parseInt(value),
                },
              },
            },
          ),
        }),
        plugins: [new CamelCasePlugin()],
      }),
      EventEmitterModule.forRoot(),
    ];

    const providers: any[] = [
      { provide: EnvironmentService, useClass: FakeEnvService },
      QueryCacheConfigProvider,
      BaseRepo,
      BasePropertyRepo,
      BaseRowRepo,
      BaseViewRepo,
      CollectionLoader,
      BaseQueryCacheService,
      DbHandle,
    ];

    if (redisReachable) {
      imports.push(
        RedisModule.forRoot({
          readyLog: false,
          config: { host: '127.0.0.1', port: 6379 },
        }),
      );
      providers.push(BaseQueryCacheWriteConsumer, BaseQueryCacheSubscriber);
    }

    moduleRef = await Test.createTestingModule({
      imports,
      providers,
    }).compile();

    if (redisReachable) {
      await moduleRef.init();
    }

    cache = moduleRef.get(BaseQueryCacheService);
    baseRowRepo = moduleRef.get(BaseRowRepo);
    basePropertyRepo = moduleRef.get(BasePropertyRepo);
    dbHandle = moduleRef.get(DbHandle);
    eventEmitter = moduleRef.get(EventEmitter2);

    const workspace = await dbHandle.db
      .selectFrom('workspaces')
      .select(['id'])
      .limit(1)
      .executeTakeFirstOrThrow();
    workspaceId = workspace.id;

    const space = await dbHandle.db
      .selectFrom('spaces')
      .select(['id'])
      .where('workspaceId', '=', workspaceId)
      .limit(1)
      .executeTakeFirstOrThrow();
    spaceId = space.id;

    const user = await dbHandle.db
      .selectFrom('users')
      .select('id')
      .limit(1)
      .executeTakeFirst();
    creatorUserId = user?.id ?? null;

    const { baseId } = await seedBase({
      db: dbHandle.db as any,
      workspaceId,
      spaceId,
      creatorUserId,
      rows: 10000,
      name: `cache-integration-${Date.now()}`,
    });
    seededBaseId = baseId;
  }, 180_000);

  afterAll(async () => {
    if (seededBaseId) {
      await deleteSeededBase(dbHandle.db as any, seededBaseId);
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  }, 60_000);

  it(
    'returns the same rows as Postgres for a numeric-sort full pagination',
    async () => {
      const baseId = seededBaseId!;
      const properties = await basePropertyRepo.findByBaseId(baseId);
      const schema: PropertySchema = new Map(properties.map((p) => [p.id, p]));
      const estimateProp = properties.find((p) => p.name === 'Estimate');
      if (!estimateProp) throw new Error('Estimate property not found');

      const limit = 500;

      const pgIds: string[] = [];
      let pgCursor: string | undefined = undefined;
      for (;;) {
        const page = await baseRowRepo.list({
          baseId,
          workspaceId,
          sorts: [{ propertyId: estimateProp.id, direction: 'asc' }],
          schema,
          pagination: { limit, cursor: pgCursor } as any,
        });
        for (const item of page.items) pgIds.push(item.id);
        if (!page.meta.hasNextPage || !page.meta.nextCursor) break;
        pgCursor = page.meta.nextCursor;
      }

      const ddIds: string[] = [];
      let ddCursor: string | undefined = undefined;
      for (;;) {
        const page = await cache.list(baseId, workspaceId, {
          sorts: [{ propertyId: estimateProp.id, direction: 'asc' }],
          schema,
          pagination: { limit, cursor: ddCursor } as any,
        });
        for (const item of page.items) ddIds.push(item.id);
        if (!page.meta.hasNextPage || !page.meta.nextCursor) break;
        ddCursor = page.meta.nextCursor;
      }

      // Both engines should emit every live row at least once, and DuckDB
      // should emit each row exactly once (no duplicates). We compare
      // unique sorted id lists rather than raw page arrays because the
      // existing Postgres engine can repeat rows on tie-heavy numeric
      // sorts when the DB's default collation applies non-byte ordering
      // to `position`.
      const ddUniq = new Set(ddIds);
      expect(ddIds.length).toBe(ddUniq.size); // DuckDB emits no duplicates
      expect(ddUniq.size).toBe(10_000);
      const pgSorted = [...new Set(pgIds)].sort();
      const ddSorted = [...ddUniq].sort();
      expect(ddSorted).toEqual(pgSorted);
    },
    60_000,
  );

  it(
    'applyChange upsert reflects in subsequent list reads',
    async () => {
      const baseId = seededBaseId!;
      const properties = await basePropertyRepo.findByBaseId(baseId);
      const schema: PropertySchema = new Map(properties.map((p) => [p.id, p]));
      const estimateProp = properties.find((p) => p.name === 'Estimate');
      if (!estimateProp) throw new Error('Estimate property not found');

      // Force the collection to load.
      const firstPage = await cache.list(baseId, workspaceId, {
        schema,
        pagination: { limit: 1 } as any,
      });
      expect(firstPage.items.length).toBe(1);
      const targetRowId = firstPage.items[0].id;

      // Patch the row directly in Postgres and apply the envelope via the
      // cache service's public API (pubsub-free — deterministic).
      const nextEstimate = 424242;
      const pgRow = await baseRowRepo.findById(targetRowId, { workspaceId });
      if (!pgRow) throw new Error('Row not found');
      const newCells = {
        ...(pgRow.cells as Record<string, unknown>),
        [estimateProp.id]: nextEstimate,
      };
      await dbHandle.db
        .updateTable('baseRows')
        .set({ cells: newCells as any })
        .where('id', '=', targetRowId)
        .where('workspaceId', '=', workspaceId)
        .execute();

      const envelope: ChangeEnvelope = {
        kind: 'row-upsert',
        baseId,
        row: { ...pgRow, cells: newCells } as unknown as Record<string, unknown>,
      };
      await cache.applyChange(envelope);

      // Read back via DuckDB with a filter that should only match the
      // freshly-patched value.
      const page = await cache.list(baseId, workspaceId, {
        schema,
        filter: {
          propertyId: estimateProp.id,
          op: 'eq',
          value: nextEstimate,
        } as any,
        pagination: { limit: 5 } as any,
      });
      const ids = page.items.map((r) => r.id);
      expect(ids).toContain(targetRowId);
    },
    60_000,
  );

  const itIfScale =
    INTEGRATION_DB_URL && process.env.SCALE_TEST === 'true' ? it : it.skip;

  itIfScale(
    '100K base: cache and postgres return identical rows for common queries',
    async () => {
      const seeded = await seedBase({
        db: dbHandle.db as any,
        workspaceId,
        spaceId,
        creatorUserId,
        rows: 100_000,
        name: `cache-scale-${Date.now()}`,
      });
      const scaleBaseId = seeded.baseId;
      try {
        const properties = await basePropertyRepo.findByBaseId(scaleBaseId);
        const schema: PropertySchema = new Map(
          properties.map((p) => [p.id, p]),
        );

        const statusChoice = seeded.statusChoiceIds[0];
        if (!statusChoice) throw new Error('Status choice not seeded');

        // Query shapes. High-cardinality sort keys (text, date-with-time) are
        // preferred for strict-array-equality parity. We include one
        // low-cardinality filter (status eq) to exercise that path as well.
        const queryShapes: Array<{
          label: string;
          filter?: any;
          sorts?: Array<{ propertyId: string; direction: 'asc' | 'desc' }>;
        }> = [
          {
            label: 'text sort desc (high-cardinality)',
            sorts: [
              { propertyId: seeded.propertyIds.text, direction: 'desc' },
            ],
          },
          {
            label: 'status eq (low-cardinality filter)',
            filter: {
              op: 'and',
              children: [
                {
                  propertyId: seeded.propertyIds.status,
                  op: 'eq',
                  value: statusChoice,
                },
              ],
            },
          },
          {
            label: 'number gt 5000 + date desc',
            filter: {
              op: 'and',
              children: [
                {
                  propertyId: seeded.propertyIds.number,
                  op: 'gt',
                  value: 5000,
                },
              ],
            },
            sorts: [
              { propertyId: seeded.propertyIds.date, direction: 'desc' },
            ],
          },
          {
            label: 'number asc (tie-heavy numeric sort)',
            sorts: [
              { propertyId: seeded.propertyIds.number, direction: 'asc' },
            ],
          },
        ];

        const PAGE_LIMIT = 500;

        // Postgres refuses to start subtransactions inside parallel workers,
        // and the `base_cell_*` UDFs use PL/pgSQL EXCEPTION blocks which need
        // one. At 100K rows the planner picks a parallel seq scan and crashes
        // with "cannot start subtransactions during a parallel operation".
        // Workaround: run all PG list calls inside a transaction that first
        // disables parallel query. Tracked separately — once the UDFs are
        // marked PARALLEL RESTRICTED in a migration, this wrapper can go.
        const collectPg = async (q: {
          filter?: any;
          sorts?: any;
        }): Promise<string[]> => {
          return dbHandle.db.transaction().execute(async (trx) => {
            await sql`SET LOCAL max_parallel_workers_per_gather = 0`.execute(
              trx,
            );
            const ids: string[] = [];
            let cursor: string | undefined = undefined;
            for (;;) {
              const page = await baseRowRepo.list({
                baseId: scaleBaseId,
                workspaceId,
                filter: q.filter,
                sorts: q.sorts,
                schema,
                pagination: { limit: PAGE_LIMIT, cursor } as any,
                trx: trx as any,
              });
              for (const item of page.items) ids.push(item.id);
              if (!page.meta.hasNextPage || !page.meta.nextCursor) break;
              cursor = page.meta.nextCursor;
            }
            return ids;
          });
        };

        const collectCache = async (q: {
          filter?: any;
          sorts?: any;
        }): Promise<string[]> => {
          const ids: string[] = [];
          let cursor: string | undefined = undefined;
          for (;;) {
            const page = await cache.list(scaleBaseId, workspaceId, {
              filter: q.filter,
              sorts: q.sorts,
              schema,
              pagination: { limit: PAGE_LIMIT, cursor } as any,
            });
            for (const item of page.items) ids.push(item.id);
            if (!page.meta.hasNextPage || !page.meta.nextCursor) break;
            cursor = page.meta.nextCursor;
          }
          return ids;
        };

        for (const q of queryShapes) {
          const pgIds = await collectPg(q);
          const dkIds = await collectCache(q);

          const pgUniq = new Set(pgIds);
          const dkUniq = new Set(dkIds);
          // DuckDB must never emit duplicates.
          expect(dkIds.length).toBe(dkUniq.size);

          if (pgIds.length === pgUniq.size) {
            // Strict ordering parity when PG emits no dupes.
            expect(dkIds).toEqual(pgIds);
          } else {
            // PG tie-sort bug surfaced duplicates — fall back to the
            // unique-set comparison (same workaround as the 10K numeric-sort
            // parity test). TODO: remove once the PG tie-sort duplicate
            // emission is fixed (tracked separately).
            expect([...dkUniq].sort()).toEqual([...pgUniq].sort());
          }
        }
      } finally {
        await deleteSeededBase(dbHandle.db as any, scaleBaseId);
      }
    },
    300_000,
  );

  it(
    'pubsub round-trip: BASE_ROW_UPDATED event propagates to DuckDB',
    async () => {
      if (!redisReachable) {
        console.warn('Skipping pubsub round-trip: Redis not reachable');
        return;
      }
      const baseId = seededBaseId!;
      const properties = await basePropertyRepo.findByBaseId(baseId);
      const schema: PropertySchema = new Map(properties.map((p) => [p.id, p]));
      const estimateProp = properties.find((p) => p.name === 'Estimate');
      if (!estimateProp) throw new Error('Estimate property not found');

      // Force the collection to load.
      const firstPage = await cache.list(baseId, workspaceId, {
        schema,
        pagination: { limit: 1 } as any,
      });
      expect(firstPage.items.length).toBe(1);
      const targetRowId = firstPage.items[0].id;

      const nextEstimate = 999_001;
      const pgRow = await baseRowRepo.findById(targetRowId, { workspaceId });
      if (!pgRow) throw new Error('Row not found');
      const newCells = {
        ...(pgRow.cells as Record<string, unknown>),
        [estimateProp.id]: nextEstimate,
      };
      await dbHandle.db
        .updateTable('baseRows')
        .set({ cells: newCells as any })
        .where('id', '=', targetRowId)
        .where('workspaceId', '=', workspaceId)
        .execute();

      const event: BaseRowUpdatedEvent = {
        baseId,
        workspaceId,
        actorId: null,
        requestId: null,
        rowId: targetRowId,
        patch: { [estimateProp.id]: nextEstimate },
        updatedCells: { [estimateProp.id]: nextEstimate },
      };
      eventEmitter.emit(EventName.BASE_ROW_UPDATED, event);

      // Wait for Redis pubsub round-trip.
      await new Promise((r) => setTimeout(r, 500));

      const page = await cache.list(baseId, workspaceId, {
        schema,
        filter: {
          propertyId: estimateProp.id,
          op: 'eq',
          value: nextEstimate,
        } as any,
        pagination: { limit: 5 } as any,
      });
      const ids = page.items.map((r) => r.id);
      expect(ids).toContain(targetRowId);
    },
    60_000,
  );
});

describeIntegration('BaseQueryCacheService warm-up on boot', () => {
  @Injectable()
  class WarmUpEnvService {
    getDatabaseURL() {
      return INTEGRATION_DB_URL!;
    }
    getDatabaseMaxPool() {
      return 5;
    }
    getNodeEnv() {
      return 'test';
    }
    getBaseQueryCacheEnabled() {
      return true;
    }
    getBaseQueryCacheMinRows() {
      return 100;
    }
    getBaseQueryCacheMaxCollections() {
      return 5;
    }
    getBaseQueryCacheWarmTopN() {
      return 5;
    }
    getRedisUrl() {
      return REDIS_URL;
    }
  }

  async function buildModule(): Promise<TestingModule> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        KyselyModule.forRoot({
          dialect: new PostgresJSDialect({
            postgres: (postgres as any)(
              normalizePostgresUrl(INTEGRATION_DB_URL!),
              {
                max: 5,
                onnotice: () => {},
                types: {
                  bigint: {
                    to: 20,
                    from: [20, 1700],
                    serialize: (value: number) => value.toString(),
                    parse: (value: string) => Number.parseInt(value),
                  },
                },
              },
            ),
          }),
          plugins: [new CamelCasePlugin()],
        }),
        EventEmitterModule.forRoot(),
        RedisModule.forRoot({
          readyLog: false,
          config: { host: '127.0.0.1', port: 6379 },
        }),
      ],
      providers: [
        { provide: EnvironmentService, useClass: WarmUpEnvService },
        QueryCacheConfigProvider,
        BaseRepo,
        BasePropertyRepo,
        BaseRowRepo,
        BaseViewRepo,
        CollectionLoader,
        BaseQueryCacheService,
        DbHandle,
      ],
    }).compile();
    await moduleRef.init();
    return moduleRef;
  }

  let firstModule: TestingModule | null = null;
  let secondModule: TestingModule | null = null;
  let seededBaseId: string | null = null;
  let redisReachable = false;
  let probeRedis: Redis | null = null;

  beforeAll(async () => {
    process.env.DATABASE_URL = INTEGRATION_DB_URL;
    process.env.REDIS_URL = REDIS_URL;
    redisReachable = await isRedisReachable();
    if (!redisReachable) return;

    probeRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
    // Scrub any stale state from prior runs so zrevrange returns only the
    // ids this test records.
    await probeRedis.del('base-query-cache:recent');

    firstModule = await buildModule();
    const dbHandle = firstModule.get(DbHandle);

    const workspace = await dbHandle.db
      .selectFrom('workspaces')
      .select(['id'])
      .limit(1)
      .executeTakeFirstOrThrow();
    const space = await dbHandle.db
      .selectFrom('spaces')
      .select(['id'])
      .where('workspaceId', '=', workspace.id)
      .limit(1)
      .executeTakeFirstOrThrow();
    const user = await dbHandle.db
      .selectFrom('users')
      .select('id')
      .limit(1)
      .executeTakeFirst();

    const seed = await seedBase({
      db: dbHandle.db as any,
      workspaceId: workspace.id,
      spaceId: space.id,
      creatorUserId: user?.id ?? null,
      rows: 200,
      name: `cache-warmup-${Date.now()}`,
    });
    seededBaseId = seed.baseId;
  }, 180_000);

  afterAll(async () => {
    if (firstModule && seededBaseId) {
      const dbHandle = firstModule.get(DbHandle);
      await deleteSeededBase(dbHandle.db as any, seededBaseId);
    }
    if (firstModule) await firstModule.close();
    if (secondModule) await secondModule.close();
    if (probeRedis) {
      try {
        await probeRedis.del('base-query-cache:recent');
      } catch {}
      probeRedis.disconnect();
    }
  }, 60_000);

  it(
    'records access in redis and warms the collection on boot',
    async () => {
      if (!redisReachable) {
        console.warn('Skipping warm-up test: Redis not reachable');
        return;
      }
      const baseId = seededBaseId!;
      const cache = firstModule!.get(BaseQueryCacheService);
      const basePropertyRepo = firstModule!.get(BasePropertyRepo);
      const dbHandle = firstModule!.get(DbHandle);

      const workspace = await dbHandle.db
        .selectFrom('workspaces')
        .select(['id'])
        .limit(1)
        .executeTakeFirstOrThrow();
      const workspaceId = workspace.id;

      const properties = await basePropertyRepo.findByBaseId(baseId);
      const schema: PropertySchema = new Map(properties.map((p) => [p.id, p]));

      await cache.list(baseId, workspaceId, {
        schema,
        pagination: { limit: 10 } as any,
      });

      // recordAccess is fire-and-forget; give the ZADD time to round-trip.
      await new Promise((r) => setTimeout(r, 200));

      const recent = await probeRedis!.zrevrange(
        'base-query-cache:recent',
        0,
        0,
      );
      expect(recent).toEqual([baseId]);

      // Simulate a fresh boot: close the current service, build a new module,
      // and assert warm-up populates the collection without calling list().
      await firstModule!.close();
      firstModule = null;

      secondModule = await buildModule();
      const cache2 = secondModule.get(BaseQueryCacheService);

      // onApplicationBootstrap is called by moduleRef.init() above; but to be
      // explicit about the warm-up path we assert residency directly.
      expect(cache2.isResident(baseId)).toBe(true);

      const page = await cache2.list(baseId, workspaceId, {
        schema,
        pagination: { limit: 10 } as any,
      });
      expect(page.items.length).toBe(10);
    },
    120_000,
  );
});
