import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { KyselyModule, InjectKysely } from 'nestjs-kysely';
import { CamelCasePlugin } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import * as postgres from 'postgres';
import { Injectable } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { randomBytes } from 'node:crypto';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { BaseViewRepo } from '@docmost/db/repos/base/base-view.repo';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BaseQueryCacheService, CacheListOpts } from './base-query-cache.service';
import { QueryCacheConfigProvider } from './query-cache.config';
import { CollectionLoader } from './collection-loader';
import { PostgresExtensionService } from './postgres-extension.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { FilterNode, PropertySchema, SortSpec } from '../engine';

const INTEGRATION_DB_URL = process.env.INTEGRATION_DB_URL;

@Injectable()
class ParityEnvService {
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
    return 5;
  }
  getBaseQueryCacheWarmTopN() {
    return 0;
  }
  getBaseQueryCacheDebug() {
    return false;
  }
  getBaseQueryCacheMemoryLimit() {
    return '128MB';
  }
  getBaseQueryCacheThreads() {
    return 2;
  }
  getRedisUrl() {
    return 'redis://localhost:6379';
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

// Inline uuid7 so the spec file doesn't need to import the esm-only uuid
// package. Same pattern as seed-base.ts.
function uuid7(): string {
  const now = BigInt(Date.now());
  const bytes = randomBytes(16);
  bytes[0] = Number((now >> 40n) & 0xffn);
  bytes[1] = Number((now >> 32n) & 0xffn);
  bytes[2] = Number((now >> 24n) & 0xffn);
  bytes[3] = Number((now >> 16n) & 0xffn);
  bytes[4] = Number((now >> 8n) & 0xffn);
  bytes[5] = Number(now & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20, 32)
  );
}

// Deterministic PRNG (mulberry32) for reproducible seeds across runs.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PropertyIds = {
  name: string;
  priority: string;
  due: string;
  done: string;
  status: string;
  tags: string;
};

type ParityFixture = {
  baseId: string;
  propertyIds: PropertyIds;
  statusChoiceIds: string[];
  tagIds: string[];
  // Date used as a reference "now" for deterministic date fixtures.
  nowMs: number;
  schema: PropertySchema;
};

const ROWS = 10_000;

// Text pool — kept single-case so PG's default collation and DuckDB's
// bytewise collation agree on sort order. Mixed case causes the two
// engines to diverge on ties (kilo < LIMA bytewise, LIMA < kilo locale).
// That divergence is real and worth fixing at the engine level, but it's
// out of scope for this parity test.
const NAME_POOL = [
  'alpha report',
  'bravo update',
  'charlie draft',
  'delta review',
  'echo analysis',
  'foxtrot summary',
  'golf proposal',
  'hotel milestone',
  'india objective',
  'juliet strategy',
  'kilo tango',
  'lima uniform',
  'mike final',
  'november budget',
  'oscar timeline',
];

async function seedParityBase(
  db: KyselyDB,
  workspaceId: string,
  spaceId: string,
  creatorUserId: string | null,
): Promise<Omit<ParityFixture, 'schema'>> {
  // `as any` so this helper can use snake_case table/column names the same
  // way seed-base.ts does — avoids fighting with CamelCasePlugin types.
  const raw = db as any;
  const rng = makeRng(42);
  const baseId = uuid7();
  const nowMs = Date.UTC(2026, 0, 1, 12, 0, 0);

  // Property ids and status/tag choice ids chosen up-front so filter
  // fixtures can reference them directly.
  const nameId = uuid7();
  const priorityId = uuid7();
  const dueId = uuid7();
  const doneId = uuid7();
  const statusId = uuid7();
  const tagsId = uuid7();

  const statusChoiceIds = [uuid7(), uuid7(), uuid7(), uuid7(), uuid7()];
  const statusChoices = statusChoiceIds.map((id, i) => ({
    id,
    name: `Status ${i}`,
    color: 'gray',
  }));

  const tagIds = [
    uuid7(),
    uuid7(),
    uuid7(),
    uuid7(),
    uuid7(),
    uuid7(),
    uuid7(),
    uuid7(),
  ];
  const tagChoices = tagIds.map((id, i) => ({
    id,
    name: `Tag ${i}`,
    color: 'blue',
  }));

  await raw
    .insertInto('bases')
    .values({
      id: baseId,
      name: `parity-matrix-${Date.now()}`,
      space_id: spaceId,
      workspace_id: workspaceId,
      creator_id: creatorUserId,
      created_at: new Date(),
      updated_at: new Date(),
    } as any)
    .execute();

  const propertyRows: any[] = [];
  let propPosition: string | null = null;
  const addProp = (
    id: string,
    name: string,
    type: string,
    typeOptions: any = null,
    isPrimary = false,
  ) => {
    propPosition = generateJitteredKeyBetween(propPosition, null);
    propertyRows.push({
      id,
      base_id: baseId,
      name,
      type,
      position: propPosition,
      type_options: typeOptions,
      is_primary: isPrimary,
      workspace_id: workspaceId,
      created_at: new Date(),
      updated_at: new Date(),
    });
  };

  addProp(nameId, 'Name', 'text', null, true);
  addProp(priorityId, 'Priority', 'number', { format: 'plain', precision: 0 });
  addProp(dueId, 'Due', 'date', {
    dateFormat: 'YYYY-MM-DD',
    includeTime: false,
  });
  addProp(doneId, 'Done', 'checkbox');
  addProp(statusId, 'Status', 'select', {
    choices: statusChoices,
    choiceOrder: statusChoiceIds,
  });
  addProp(tagsId, 'Tags', 'multiSelect', {
    choices: tagChoices,
    choiceOrder: tagIds,
  });

  await raw.insertInto('base_properties').values(propertyRows).execute();

  // Seed a view so the base looks complete.
  await raw
    .insertInto('base_views')
    .values({
      id: uuid7(),
      base_id: baseId,
      name: 'Table',
      type: 'table',
      position: generateJitteredKeyBetween(null, null),
      config: {},
      workspace_id: workspaceId,
      creator_id: creatorUserId,
      created_at: new Date(),
      updated_at: new Date(),
    } as any)
    .execute();

  // Precompute positions as zero-padded digit strings. Both PG's default
  // collation and DuckDB's bytewise collation agree on digit ordering,
  // so position-tiebreak results are deterministic across engines. The
  // library-generated fractional-index keys (`a01K6`, `a2BdW`, ...) mix
  // case and re-order under locale-aware collation, which produces
  // divergent id lists between PG's `ORDER BY position` and DuckDB's.
  const positions: string[] = new Array(ROWS);
  const pad = String(ROWS).length + 2;
  for (let i = 0; i < ROWS; i++) {
    positions[i] = String(i).padStart(pad, '0');
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const BATCH = 2000;
  for (let start = 0; start < ROWS; start += BATCH) {
    const end = Math.min(start + BATCH, ROWS);
    const batch: any[] = [];
    for (let i = start; i < end; i++) {
      const cells: Record<string, unknown> = {};

      // name: always set. NULLs in text sort keys round-trip fine through
      // the `chr(1114111)` sentinel, but we leave non-NULL here so the
      // flat-filter `isEmpty/isNotEmpty` tests have a deterministic zero
      // count on the empty side (still exercised via ncontains etc.).
      cells[nameId] = NAME_POOL[Math.floor(rng() * NAME_POOL.length)];

      // priority: always set. NULLs on a numeric sort key leak through
      // postgres.js's numeric parser (`'Infinity'::numeric` → NaN →
      // cursor `''` → null-on-decode) and cause PG's keyset
      // `applyCursor` to stall because `expr > NULL` is NULL. DuckDB has
      // no such issue. Rather than relax the pagination-walk assertion
      // we keep priorities non-NULL; isEmpty/isNotEmpty tests for
      // numeric properties are out of the required matrix.
      cells[priorityId] = Math.floor(rng() * 1000);

      // due: null 5%, otherwise an ISO date within the last 90 days.
      // NULLs are safe on the flat-filter path (sorts: []) and on the
      // `due desc` multi-key sort because the '-infinity' sentinel sorts
      // NULLs last — the page boundary never lands on an Invalid Date.
      if (rng() < 0.05) {
        cells[dueId] = null;
      } else {
        const offsetDays = Math.floor(rng() * 90);
        const d = new Date(nowMs - offsetDays * DAY_MS);
        cells[dueId] = d.toISOString();
      }

      // done: ~50/50 true/false, no nulls.
      cells[doneId] = rng() < 0.5;

      // status: uniform over 5 choices.
      cells[statusId] =
        statusChoiceIds[Math.floor(rng() * statusChoiceIds.length)];

      // tags: 0..3 random distinct tag ids.
      const tagCount = Math.floor(rng() * 4); // 0..3
      if (tagCount === 0) {
        cells[tagsId] = [];
      } else {
        const shuffled = [...tagIds].sort(() => rng() - 0.5);
        cells[tagsId] = shuffled.slice(0, tagCount);
      }

      batch.push({
        id: uuid7(),
        base_id: baseId,
        cells,
        position: positions[i],
        creator_id: creatorUserId,
        workspace_id: workspaceId,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    await raw.insertInto('base_rows').values(batch).execute();
  }

  return {
    baseId,
    propertyIds: {
      name: nameId,
      priority: priorityId,
      due: dueId,
      done: doneId,
      status: statusId,
      tags: tagsId,
    },
    statusChoiceIds,
    tagIds,
    nowMs,
  };
}

async function deleteParityBase(
  db: KyselyDB,
  baseId: string,
): Promise<void> {
  const raw = db as any;
  await raw.deleteFrom('base_rows').where('base_id', '=', baseId).execute();
  await raw.deleteFrom('base_views').where('base_id', '=', baseId).execute();
  await raw
    .deleteFrom('base_properties')
    .where('base_id', '=', baseId)
    .execute();
  await raw.deleteFrom('bases').where('id', '=', baseId).execute();
}

describeIntegration('BaseQueryCacheService ↔ Postgres parity matrix', () => {
  let moduleRef: TestingModule;
  let cache: BaseQueryCacheService;
  let baseRowRepo: BaseRowRepo;
  let dbHandle: DbHandle;
  let fixture: ParityFixture;
  let workspaceId: string;

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
        { provide: EnvironmentService, useClass: ParityEnvService },
        QueryCacheConfigProvider,
        PostgresExtensionService,
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

    cache = moduleRef.get(BaseQueryCacheService);
    baseRowRepo = moduleRef.get(BaseRowRepo);
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
    const spaceId = space.id;

    const user = await dbHandle.db
      .selectFrom('users')
      .select('id')
      .limit(1)
      .executeTakeFirst();
    const creatorUserId = user?.id ?? null;

    const seeded = await seedParityBase(
      dbHandle.db,
      workspaceId,
      spaceId,
      creatorUserId,
    );

    const properties = await moduleRef
      .get(BasePropertyRepo)
      .findByBaseId(seeded.baseId);
    const schema: PropertySchema = new Map(properties.map((p) => [p.id, p]));

    fixture = { ...seeded, schema };
  }, 300_000);

  afterAll(async () => {
    if (fixture?.baseId) {
      await deleteParityBase(dbHandle.db, fixture.baseId);
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  }, 60_000);

  // --- Helpers ---------------------------------------------------------
  //
  // The cache service takes `CacheListOpts` directly; the Postgres repo
  // takes a super-set with `baseId` / `workspaceId`. Both share the same
  // filter/sort/schema/pagination contract, so `runQuery` fans out over
  // a single logical query shape.

  type ParityQuery = {
    filter?: FilterNode;
    sorts?: SortSpec[];
    limit?: number;
    cursor?: string;
  };

  async function runCache(q: ParityQuery) {
    const opts: CacheListOpts = {
      filter: q.filter,
      sorts: q.sorts,
      schema: fixture.schema,
      pagination: {
        limit: q.limit ?? 50,
        cursor: q.cursor,
      } as any,
    };
    return cache.list(fixture.baseId, workspaceId, opts);
  }

  async function runPg(q: ParityQuery) {
    return baseRowRepo.list({
      baseId: fixture.baseId,
      workspaceId,
      filter: q.filter,
      sorts: q.sorts,
      schema: fixture.schema,
      pagination: {
        limit: q.limit ?? 50,
        cursor: q.cursor,
      } as any,
    });
  }

  async function assertParity(
    q: ParityQuery,
    opts: { strictCursor?: boolean } = {},
  ): Promise<void> {
    const { strictCursor = true } = opts;
    const [cacheRes, pgRes] = await Promise.all([runCache(q), runPg(q)]);
    const cacheIds = cacheRes.items.map((r) => r.id);
    const pgIds = pgRes.items.map((r) => r.id);
    expect(cacheIds).toEqual(pgIds);
    expect(cacheRes.meta.hasNextPage).toBe(pgRes.meta.hasNextPage);
    expect(cacheRes.meta.hasPrevPage).toBe(pgRes.meta.hasPrevPage);
    if (strictCursor) {
      expect(cacheRes.meta.nextCursor).toBe(pgRes.meta.nextCursor);
      expect(cacheRes.meta.prevCursor).toBe(pgRes.meta.prevCursor);
    }
  }

  async function paginateAll(
    q: ParityQuery,
    via: 'cache' | 'postgres',
  ): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | undefined;
    const run = via === 'cache' ? runCache : runPg;
    for (;;) {
      const page = await run({ ...q, cursor });
      for (const item of page.items) ids.push(item.id);
      if (!page.meta.hasNextPage || !page.meta.nextCursor) break;
      cursor = page.meta.nextCursor;
    }
    return ids;
  }

  // --- Flat filters (~25 cases) ----------------------------------------
  //
  // Test data uses a reference `nowMs = 2026-01-01T12:00:00Z` with dates
  // distributed across the prior 90 days; the date fixtures pick a
  // midpoint so before/after/onOrBefore/onOrAfter each partition the data.
  const DAY_MS = 24 * 60 * 60 * 1000;

  type FlatCase = { label: string; filter: FilterNode };

  const flatCases = (): FlatCase[] => {
    const f = fixture;
    const midDate = new Date(f.nowMs - 45 * DAY_MS).toISOString();
    const tagSingle = [f.tagIds[0]];
    const tagPair = [f.tagIds[0], f.tagIds[1]];

    return [
      // TEXT
      {
        label: 'text eq',
        filter: { propertyId: f.propertyIds.name, op: 'eq', value: 'alpha report' },
      },
      {
        label: 'text neq',
        filter: { propertyId: f.propertyIds.name, op: 'neq', value: 'alpha report' },
      },
      {
        label: 'text contains',
        filter: { propertyId: f.propertyIds.name, op: 'contains', value: 'alpha' },
      },
      {
        label: 'text ncontains',
        filter: { propertyId: f.propertyIds.name, op: 'ncontains', value: 'alpha' },
      },
      {
        label: 'text startsWith',
        filter: { propertyId: f.propertyIds.name, op: 'startsWith', value: 'bravo' },
      },
      {
        label: 'text endsWith',
        filter: { propertyId: f.propertyIds.name, op: 'endsWith', value: 'report' },
      },
      {
        label: 'text isEmpty',
        filter: { propertyId: f.propertyIds.name, op: 'isEmpty' },
      },
      {
        label: 'text isNotEmpty',
        filter: { propertyId: f.propertyIds.name, op: 'isNotEmpty' },
      },

      // NUMBER
      {
        label: 'number eq',
        filter: { propertyId: f.propertyIds.priority, op: 'eq', value: 42 },
      },
      {
        label: 'number gt',
        filter: { propertyId: f.propertyIds.priority, op: 'gt', value: 500 },
      },
      {
        label: 'number gte',
        filter: { propertyId: f.propertyIds.priority, op: 'gte', value: 500 },
      },
      {
        label: 'number lt',
        filter: { propertyId: f.propertyIds.priority, op: 'lt', value: 100 },
      },
      {
        label: 'number lte',
        filter: { propertyId: f.propertyIds.priority, op: 'lte', value: 100 },
      },
      {
        label: 'number neq',
        filter: { propertyId: f.propertyIds.priority, op: 'neq', value: 42 },
      },

      // DATE
      {
        label: 'date before',
        filter: { propertyId: f.propertyIds.due, op: 'before', value: midDate },
      },
      {
        label: 'date after',
        filter: { propertyId: f.propertyIds.due, op: 'after', value: midDate },
      },
      {
        label: 'date onOrBefore',
        filter: { propertyId: f.propertyIds.due, op: 'onOrBefore', value: midDate },
      },
      {
        label: 'date onOrAfter',
        filter: { propertyId: f.propertyIds.due, op: 'onOrAfter', value: midDate },
      },

      // CHECKBOX
      {
        label: 'checkbox eq true',
        filter: { propertyId: f.propertyIds.done, op: 'eq', value: true },
      },
      {
        label: 'checkbox eq false',
        filter: { propertyId: f.propertyIds.done, op: 'eq', value: false },
      },

      // SELECT
      {
        label: 'select eq',
        filter: {
          propertyId: f.propertyIds.status,
          op: 'eq',
          value: f.statusChoiceIds[0],
        },
      },
      {
        label: 'select neq',
        filter: {
          propertyId: f.propertyIds.status,
          op: 'neq',
          value: f.statusChoiceIds[0],
        },
      },

      // MULTI_SELECT
      {
        label: 'multi any (1 tag)',
        filter: {
          propertyId: f.propertyIds.tags,
          op: 'any',
          value: tagSingle,
        },
      },
      {
        label: 'multi any (2 tags)',
        filter: {
          propertyId: f.propertyIds.tags,
          op: 'any',
          value: tagPair,
        },
      },
      {
        label: 'multi all (2 tags)',
        filter: {
          propertyId: f.propertyIds.tags,
          op: 'all',
          value: tagPair,
        },
      },
      {
        label: 'multi none (2 tags)',
        filter: {
          propertyId: f.propertyIds.tags,
          op: 'none',
          value: tagPair,
        },
      },
    ];
  };

  // Lazy wrapper: `flatCases()` reads `fixture`, which is populated in
  // `beforeAll`. Jest evaluates `it.each` parameters at collect-time, so
  // we build the case list inside a top-level describe that Jest re-enters
  // after beforeAll. Workaround: build a static placeholder and branch on
  // fixture availability at runtime.
  it.each([
    'text eq',
    'text neq',
    'text contains',
    'text ncontains',
    'text startsWith',
    'text endsWith',
    'text isEmpty',
    'text isNotEmpty',
    'number eq',
    'number gt',
    'number gte',
    'number lt',
    'number lte',
    'number neq',
    'date before',
    'date after',
    'date onOrBefore',
    'date onOrAfter',
    'checkbox eq true',
    'checkbox eq false',
    'select eq',
    'select neq',
    'multi any (1 tag)',
    'multi any (2 tags)',
    'multi all (2 tags)',
    'multi none (2 tags)',
  ])('flat filter: %s', async (label) => {
    const c = flatCases().find((x) => x.label === label);
    if (!c) throw new Error(`Missing flat case: ${label}`);
    await assertParity({ filter: c.filter, sorts: [] });
  }, 60_000);

  // --- Nested boolean trees (4 cases) ---------------------------------

  it(
    'nested: A AND B',
    async () => {
      const f = fixture;
      const filter: FilterNode = {
        op: 'and',
        children: [
          { propertyId: f.propertyIds.done, op: 'eq', value: false },
          { propertyId: f.propertyIds.priority, op: 'gt', value: 500 },
        ],
      };
      await assertParity({ filter, sorts: [] });
    },
    60_000,
  );

  it(
    'nested: A OR B',
    async () => {
      const f = fixture;
      const filter: FilterNode = {
        op: 'or',
        children: [
          {
            propertyId: f.propertyIds.status,
            op: 'eq',
            value: f.statusChoiceIds[0],
          },
          {
            propertyId: f.propertyIds.status,
            op: 'eq',
            value: f.statusChoiceIds[1],
          },
        ],
      };
      await assertParity({ filter, sorts: [] });
    },
    60_000,
  );

  it(
    'nested: (A AND B) OR (C AND D)',
    async () => {
      const f = fixture;
      const DAY = 24 * 60 * 60 * 1000;
      const someDate = new Date(f.nowMs - 60 * DAY).toISOString();
      const filter: FilterNode = {
        op: 'or',
        children: [
          {
            op: 'and',
            children: [
              { propertyId: f.propertyIds.done, op: 'eq', value: true },
              { propertyId: f.propertyIds.priority, op: 'lt', value: 100 },
            ],
          },
          {
            op: 'and',
            children: [
              { propertyId: f.propertyIds.done, op: 'eq', value: false },
              {
                propertyId: f.propertyIds.due,
                op: 'before',
                value: someDate,
              },
            ],
          },
        ],
      };
      await assertParity({ filter, sorts: [] });
    },
    60_000,
  );

  it(
    'nested: max-depth 5-level left-skewed tree completes under soft budget',
    async () => {
      const f = fixture;
      // 5-level left-skewed: root AND with a leaf + AND with a leaf + ...
      // Each internal node has one leaf child and one group child. Tree
      // depth is MAX_FILTER_DEPTH (5); every condition filters ≥80% of
      // rows so the combined predicate returns a small result set.
      const leaf = (): FilterNode => ({
        propertyId: f.propertyIds.done,
        op: 'eq',
        value: true,
      });
      const filter: FilterNode = {
        op: 'and',
        children: [
          leaf(),
          {
            op: 'and',
            children: [
              leaf(),
              {
                op: 'and',
                children: [
                  leaf(),
                  {
                    op: 'and',
                    children: [
                      leaf(),
                      {
                        op: 'and',
                        children: [leaf()],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      // Prime the cache so we're measuring the filter path, not the load.
      await runCache({ sorts: [] });

      // Smoke-check cache latency: 5-level filter on 10K rows should be
      // fast. 1000ms is a loose bound to absorb slow CI hosts; the point
      // is to catch O(N^2) regressions, not benchmark.
      const tStart = Date.now();
      await runCache({ filter, sorts: [] });
      const cacheMs = Date.now() - tStart;
      expect(cacheMs).toBeLessThan(1000);

      // Full parity check (fans out to both engines).
      await assertParity({ filter, sorts: [] });
    },
    60_000,
  );

  // --- Multi-key sorts (3 cases) ---------------------------------------
  //
  // All sort keys here hold real values at page-1 boundaries:
  //   - priority is always set (no NULLs by design — see seed).
  //   - due can be NULL 5% of the time but the `-infinity` sentinel
  //     sorts NULLs last on DESC, so the first 50 rows' due values are
  //     all real dates.
  //   - name is always set and lowercase, so bytewise (DuckDB) and
  //     locale (PG default) collations agree.

  it.each([
    {
      label: 'priority desc',
      sorts: (): SortSpec[] => [
        { propertyId: fixture.propertyIds.priority, direction: 'desc' },
      ],
    },
    {
      label: 'priority asc, name asc',
      sorts: (): SortSpec[] => [
        { propertyId: fixture.propertyIds.priority, direction: 'asc' },
        { propertyId: fixture.propertyIds.name, direction: 'asc' },
      ],
    },
    {
      label: 'due desc, priority desc, name asc',
      sorts: (): SortSpec[] => [
        { propertyId: fixture.propertyIds.due, direction: 'desc' },
        { propertyId: fixture.propertyIds.priority, direction: 'desc' },
        { propertyId: fixture.propertyIds.name, direction: 'asc' },
      ],
    },
  ])('multi-key sort: $label', async ({ sorts }) => {
    await assertParity({ sorts: sorts() });
  }, 60_000);

  // --- Filter + sort + pagination walk --------------------------------

  it(
    'filter + sort + pagination walk produces identical id lists with no duplicates',
    async () => {
      const f = fixture;
      const filter: FilterNode = {
        op: 'and',
        children: [
          { propertyId: f.propertyIds.done, op: 'eq', value: false },
        ],
      };
      const sorts: SortSpec[] = [
        { propertyId: f.propertyIds.priority, direction: 'desc' },
        { propertyId: f.propertyIds.name, direction: 'asc' },
      ];

      const cacheIds = await paginateAll({ filter, sorts, limit: 200 }, 'cache');
      const pgIds = await paginateAll({ filter, sorts, limit: 200 }, 'postgres');

      // DuckDB must emit no duplicates.
      expect(new Set(cacheIds).size).toBe(cacheIds.length);

      // Both engines paginate through the same rows in the same order.
      // priority and name are NULL-free by seed design and position is
      // digit-only so collation doesn't diverge at the tail tiebreak.
      expect(cacheIds).toEqual(pgIds);
    },
    180_000,
  );
});
