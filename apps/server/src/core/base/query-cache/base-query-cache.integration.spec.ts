import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { KyselyModule, InjectKysely } from 'nestjs-kysely';
import { CamelCasePlugin } from 'kysely';
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
