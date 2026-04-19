# DuckDB-Backed Query Cache for Bases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sort + filter + search on large bases (≥25K live rows) fast and index-backed by routing qualifying `POST /bases/rows` requests to an in-process DuckDB cache instead of the JSONB-extracting Postgres path. Small bases and all writes keep their current path.

**Architecture:** A new NestJS module `BaseQueryCacheModule` owns a per-process `Map<baseId, LoadedCollection>` where each collection is a DuckDB in-memory database with one typed row table keyed by the base's user-defined properties plus the system columns (`id`, `position`, `created_at`, `updated_at`, `last_updated_by_id`, `deleted_at`, `search_text`). Typed btree indexes are built on every sortable property. Writes still commit to Postgres first; the existing `EventEmitter2` row/property events are mirrored onto a dedicated Redis pub/sub channel so each node patches its own copy of the affected collection. If a collection is absent or its `schema_version` is stale, the loader rebuilds it from Postgres via the existing `BaseRowRepo.streamByBaseId` generator. Phase-1 routing is single-node local; phase-2 multi-node routing is sketched but not implemented.

**Tech Stack:** NestJS 11 + Fastify, Kysely + postgres.js, ioredis (via `@nestjs-labs/nestjs-ioredis`), BullMQ, existing `@nestjs/event-emitter` pattern, DuckDB via `@duckdb/node-api` (official high-level binding, depends on `@duckdb/node-bindings`). Jest + ts-jest for tests.

**Scope (v1, this plan):**
- Server-side only. Client behavior is unchanged — same `listRows` endpoint, same DTO, same cursor shape.
- Feature flag `BASE_QUERY_CACHE_ENABLED` defaults to `false`. When off, zero behavior change.
- Threshold: a collection becomes a candidate when its live row count is `>= BASE_QUERY_CACHE_MIN_ROWS` (default `25000`) AND it has at least one sort / filter / search in the incoming query (the fast list-by-position path stays on Postgres regardless).
- Correctness invariant: for any query that the cache would answer, the returned page MUST equal what `BaseRowService.list` returns from Postgres (same row ids in same order, same cursor behavior). A diff test on a 10K seed base enforces this.
- LRU eviction when `BASE_QUERY_CACHE_MAX_COLLECTIONS` (default `500`) is reached. Evict by least-recently-used access timestamp.
- Warm-on-boot: a small Redis sorted set tracks recently-accessed baseIds. On `onApplicationBootstrap`, load the top N (default `50`, env `BASE_QUERY_CACHE_WARM_TOP_N`).
- Any loader/patcher failure falls through to the existing Postgres path and is logged. A DuckDB error must never surface to the client.

**Non-goals (v1, explicitly deferred):**
- Multi-node consistent-hash routing (phase 2, sketched only).
- Rollups, materialized groupings, or column-type narrowing beyond what the loader does directly.
- Client "ship everything for small bases" tier-0 optimization (separate future plan).
- Migrating the existing no-filter/no-sort list fast path (it's already index-backed in Postgres).
- Any change to the write path, write validation, or event shape.

---

## Background

### The current hot path and why it stalls

On a 100K-row base with a property sort, the server currently runs (simplified):

```sql
SELECT id, cells, position, ..., COALESCE(base_cell_text(cells, '<propertyId>'::uuid), chr(1114111)) AS s0
FROM base_rows
WHERE base_id = $1 AND workspace_id = $2 AND deleted_at IS NULL
  AND (<keyset cursor>)
ORDER BY s0 ASC, position COLLATE "C" ASC, id ASC
LIMIT 101;
```

`base_cell_text(cells, <uuid>)` is the function extractor in `apps/server/src/core/base/engine/extractors.ts`. The expression is opaque to any per-column index, so Postgres falls back to `Parallel Seq Scan` + `top-N heapsort`. Observed: ~112 ms warm, ~10 s cold, shared buffers ~400 MB touched per page. The sort cannot be pre-indexed without per-property expression indexes — infeasible multi-tenant (write amplification, storage blowup, DDL under load). See `apps/server/src/core/base/engine/sort.ts` for all sort-build sites.

### Why DuckDB (decided, not re-litigated here)

- Embedded library; no new daemon, no new container. Just an npm dep.
- Real typed columns with btree indexes and a proper planner.
- Native JSON ingest so we can bulk-load from Postgres JSONB without reshaping.
- Cheap point updates (`INSERT OR REPLACE`, `UPDATE ... WHERE id = ?`) — fits per-cell write cadence.
- Alternatives rejected: ClickHouse/chDB (poor point updates), shadow cells table in Postgres (write fanout pathological at bulk import), on-the-fly expression indexes (write amplification + DDL under load), external search stores (breaks self-host simplicity).

### DuckDB state is derived, not replicated

Postgres remains source of truth. Any node can die, any collection can be evicted, state regenerates on demand from the existing `BaseRowRepo.streamByBaseId` generator (already used by type-conversion, cell-gc, CSV export). This is why the rollout is safe: worst case, a bug in the cache path makes the system slow (falls back to Postgres); it cannot corrupt user data.

---

## Data flow at a glance

### Read path — small base

`BaseRowController.list` → `BaseRowService.list` → `BaseRowRepo.list` → Postgres. Unchanged.

### Read path — large base with filter/sort/search

`BaseRowController.list` → `BaseRowService.list` → `BaseQueryRouter.route(baseId, query)` →

- If flag off OR row count below threshold OR query has no filter/sort/search → Postgres path (unchanged).
- Else → `BaseQueryCacheService.list(baseId, query, pagination)`:
  1. If collection isn't resident: call `CollectionLoader.load(baseId)`, which reads `bases.schema_version`, fetches all properties, streams all live rows from Postgres, creates the DuckDB database + typed row table + indexes, and inserts the rows. Record the access in the LRU and in the Redis warm-set.
  2. If resident but `schema_version` mismatches the loaded version: reload.
  3. Translate the engine's filter/sort/search spec into DuckDB SQL via `DuckDbQueryBuilder`. Apply the keyset cursor (same `(sort-field…, position, id)` ordering the Postgres engine uses).
  4. Run the query, shape the result into the same `CursorPaginationResult<BaseRow>` shape the Postgres path returns.
  5. Touch LRU access timestamp + Redis warm-set.

### Write path

Unchanged at the storage layer. After `BaseRowService` emits a `BaseRow*Event`, a new in-process listener `BaseQueryCacheWriteConsumer` publishes a compact change envelope on Redis channel `base-query-cache:changes:{baseId}`. On every node, `BaseQueryCacheSubscriber` receives the envelope and, if that collection is resident locally, applies the patch (`INSERT OR REPLACE`, `UPDATE`, soft-delete, or property-schema-change ⇒ invalidate collection). Originating node included — consistent behavior across publishers and subscribers.

### Warm-up path

On `onApplicationBootstrap`, `BaseQueryCacheService.warmUp()` reads `ZREVRANGE base-query-cache:recent 0 N-1` and loads each (non-blocking, firing the loader sequentially to avoid thundering-herd on Postgres). Warm-up is best-effort; any failure is logged, the boot sequence continues.

### Eviction path

Every `list` call updates an LRU timestamp on the collection's entry. When `Map.size > MAX_COLLECTIONS`, the least-recently-accessed collection is closed (`connection.closeSync()` + `db.closeSync()`) and removed. Closed collections on next access re-load.

---

## Column-type mapping

Derived from `PropertyKind` in `apps/server/src/core/base/engine/kinds.ts` and the extractor semantics in `extractors.ts`.

| `BasePropertyType` | `PropertyKind` | DuckDB column type | Index? | Value sourced from |
|---|---|---|---|---|
| `text`, `url`, `email` | `TEXT` | `VARCHAR` | btree | `cells->>propertyId` as text |
| `number` | `NUMERIC` | `DOUBLE` | btree | JSON number → double |
| `date` | `DATE` | `TIMESTAMPTZ` | btree | ISO string → `TIMESTAMPTZ` |
| `checkbox` | `BOOL` | `BOOLEAN` | btree | JSON bool |
| `select`, `status` | `SELECT` | `VARCHAR` (choice uuid as text) | btree | `cells->>propertyId` |
| `multiSelect` | `MULTI` | `JSON` (raw) | none | JSON array of uuids — filter via `json_array_contains`, sort not supported |
| `person` (single) | `PERSON` | `VARCHAR` | btree | single uuid string |
| `person` (multi, `typeOptions.allowMultiple`) | `PERSON` | `JSON` | none | uuid array |
| `file` | `FILE` | `JSON` | none | array of file descriptors; filter only (isEmpty/isNotEmpty/any) |
| `createdAt` | system | `TIMESTAMPTZ NOT NULL` | btree | `base_rows.created_at` |
| `lastEditedAt` | system | `TIMESTAMPTZ NOT NULL` | btree | `base_rows.updated_at` |
| `lastEditedBy` | `SYS_USER` | `VARCHAR` | btree | `base_rows.last_updated_by_id` |

Plus fixed system columns every collection has:
- `id VARCHAR NOT NULL PRIMARY KEY` (uuid7 text; btree-indexed via PK)
- `position VARCHAR NOT NULL` (btree; fractional-index string, compared with BINARY collation to mirror `COLLATE "C"` in Postgres)
- `search_text VARCHAR` (btree + LIKE index where supported — initial impl uses plain `VARCHAR` + `LIKE '%…%'`; full-text is v1 out-of-scope and falls through to Postgres for `mode: 'fts'`)
- `deleted_at TIMESTAMPTZ` (rows with `deleted_at != NULL` are filtered on every query; the loader only inserts live rows so this stays NULL in steady state — kept only so soft-delete invalidation via Redis can be handled as an `UPDATE` without a shape change)

Column naming in DuckDB uses the property's `id` (uuid) verbatim, wrapped in double-quotes (`"019c69a3-dd47-7014-8b87-ec8f167577ee"`). This keeps rename-safe and removes any identifier collision with system columns.

---

## Redis channel naming

- **Change stream (per-base):** `base-query-cache:changes:{baseId}` — published on every row/property/view mutation that affects a cached collection. Payload is a minimal JSON envelope (see task 7 for schema).
- **Warm-up sorted set:** `base-query-cache:recent` — `ZADD` with timestamp score each time a collection is accessed; on boot, pull top N with `ZREVRANGE`. Capped weekly by a trim on writes (`ZREMRANGEBYRANK` to keep ≤ 10×MAX_COLLECTIONS entries).
- **Ownership lease (phase 2 only):** `base-query-cache:owner:{baseId}` — reserved, NOT used by phase 1. Phase 1 runs all nodes as potential owners.

Channel prefix `base-query-cache:` is chosen to be unambiguous and discoverable with `KEYS base-query-cache:*` during debugging, consistent with existing `presence:base:` / `typesense:` prefixes.

---

## File Structure

**New files:**

- `apps/server/src/core/base/query-cache/query-cache.module.ts` — NestJS module with all providers + `OnApplicationBootstrap` warm-up hook.
- `apps/server/src/core/base/query-cache/query-cache.types.ts` — `LoadedCollection`, `ChangeEnvelope`, `ColumnSpec`, type aliases.
- `apps/server/src/core/base/query-cache/query-cache.config.ts` — reads `BASE_QUERY_CACHE_*` env vars, exposes typed config.
- `apps/server/src/core/base/query-cache/column-types.ts` — pure property-type → DuckDB column-spec mapping (mirror of table above). Unit-testable.
- `apps/server/src/core/base/query-cache/duckdb-query-builder.ts` — pure translator from `FilterNode` / `SortSpec[]` / `SearchSpec` to DuckDB SQL fragments + parameter array. Unit-testable.
- `apps/server/src/core/base/query-cache/collection-loader.ts` — loads one base from Postgres into a DuckDB database (schema creation, row streaming, index builds).
- `apps/server/src/core/base/query-cache/base-query-cache.service.ts` — owns the `Map<baseId, LoadedCollection>`, LRU, `list()`, `invalidate()`, `applyChange()`, `warmUp()`.
- `apps/server/src/core/base/query-cache/base-query-router.ts` — decision logic: should this query go to cache or Postgres?
- `apps/server/src/core/base/query-cache/base-query-cache.write-consumer.ts` — `@OnEvent(...)` listener that publishes change envelopes to Redis.
- `apps/server/src/core/base/query-cache/base-query-cache.subscriber.ts` — Redis subscriber that receives envelopes and calls `applyChange()`.
- `apps/server/src/core/base/query-cache/column-types.spec.ts` — unit tests for the mapping.
- `apps/server/src/core/base/query-cache/duckdb-query-builder.spec.ts` — unit tests for translation.
- `apps/server/src/core/base/query-cache/base-query-router.spec.ts` — unit tests for the routing decision (pure, no DB).
- `apps/server/src/core/base/query-cache/base-query-cache.integration.spec.ts` — integration tests against real Postgres + real DuckDB (Redis stubbed out with `EventEmitter2` loopback for determinism). Enabled only when `INTEGRATION_DB_URL` is set.

**Modified files:**

- `apps/server/src/core/base/base.module.ts` — import `BaseQueryCacheModule`.
- `apps/server/src/core/base/services/base-row.service.ts` — delegate the decision in `list()` to `BaseQueryRouter`. Everything else unchanged.
- `apps/server/src/database/repos/base/base-row.repo.ts` — add `countActiveRows(baseId, workspaceId)` used by the router to decide "large base?"; add no other changes.
- `apps/server/src/integrations/environment/environment.service.ts` — getters for the four new env vars.
- `apps/server/package.json` — add `@duckdb/node-api` dep.

---

## Task 1: Add DuckDB dependency + environment getters

**Files:**
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/integrations/environment/environment.service.ts`

- [ ] **Step 1: Install `@duckdb/node-api`**

From repo root:
```bash
pnpm --filter server add @duckdb/node-api@^1.5.0
```

Expected: `@duckdb/node-api` appears in `apps/server/package.json` under `dependencies` at `^1.5.x` (this is the official high-level DuckDB Node.js binding; it depends transitively on `@duckdb/node-bindings` which is the low-level C-API wrapper — a single top-level dep is correct).

- [ ] **Step 2: Verify server still builds**

```bash
pnpm nx run server:build
```

Expected: build succeeds, no type errors.

- [ ] **Step 3: Add four new env-var getters**

Append to `apps/server/src/integrations/environment/environment.service.ts`, grouped with other feature-flag getters:

```ts
  getBaseQueryCacheEnabled(): boolean {
    return this.configService.get<string>('BASE_QUERY_CACHE_ENABLED', 'false') === 'true';
  }

  getBaseQueryCacheMinRows(): number {
    return parseInt(
      this.configService.get<string>('BASE_QUERY_CACHE_MIN_ROWS', '25000'),
      10,
    );
  }

  getBaseQueryCacheMaxCollections(): number {
    // Default is intentionally low (50) because a single-node self-host with
    // ~100 MB per collection can pin ~5 GB RSS at the cap. SaaS/larger
    // deployments can raise via env. See Appendix.
    return parseInt(
      this.configService.get<string>('BASE_QUERY_CACHE_MAX_COLLECTIONS', '50'),
      10,
    );
  }

  getBaseQueryCacheWarmTopN(): number {
    return parseInt(
      this.configService.get<string>('BASE_QUERY_CACHE_WARM_TOP_N', '50'),
      10,
    );
  }
```

- [ ] **Step 4: Commit**

This workspace uses a single root lockfile (`/Users/lite/WebstormProjects/docmost-base/pnpm-lock.yaml`, confirmed by `ls`). `pnpm --filter server add ...` still mutates only that root lockfile — no `apps/server/pnpm-lock.yaml` is created — so the staged path below is the repo-root lockfile.

```bash
git add apps/server/package.json pnpm-lock.yaml apps/server/src/integrations/environment/environment.service.ts
git commit -m "chore(server): add duckdb dependency and query-cache env getters"
```

---

## Task 2: Pure column-type mapping with unit tests

**Files:**
- Create: `apps/server/src/core/base/query-cache/column-types.ts`
- Create: `apps/server/src/core/base/query-cache/column-types.spec.ts`
- Create: `apps/server/src/core/base/query-cache/query-cache.types.ts`

- [ ] **Step 1: Define shared types**

Create `apps/server/src/core/base/query-cache/query-cache.types.ts`:

```ts
import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import type { BaseProperty } from '@docmost/db/types/entity.types';

export type DuckDbColumnType =
  | 'VARCHAR'
  | 'DOUBLE'
  | 'BOOLEAN'
  | 'TIMESTAMPTZ'
  | 'JSON';

export type ColumnSpec = {
  // The uuid of the property (user-defined props) or a stable literal
  // ('id', 'position', 'created_at', 'updated_at', 'last_updated_by_id',
  //  'deleted_at', 'search_text') for system columns.
  column: string;
  ddlType: DuckDbColumnType;
  indexable: boolean;
  // For user-defined props we keep the source BaseProperty so callers can
  // resolve the extraction rule from JSON.
  property?: Pick<BaseProperty, 'id' | 'type' | 'typeOptions'>;
};

export type LoadedCollection = {
  baseId: string;
  schemaVersion: number;
  columns: ColumnSpec[];
  instance: DuckDBInstance;
  connection: DuckDBConnection;
  lastAccessedAt: number;
};

export type ChangeEnvelope =
  | { kind: 'row-upsert'; baseId: string; row: Record<string, unknown> }
  | { kind: 'row-delete'; baseId: string; rowId: string }
  | { kind: 'rows-delete'; baseId: string; rowIds: string[] }
  | { kind: 'row-reorder'; baseId: string; rowId: string; position: string }
  | { kind: 'schema-invalidate'; baseId: string; schemaVersion: number };
```

- [ ] **Step 2: Write failing tests for the mapping**

Create `apps/server/src/core/base/query-cache/column-types.spec.ts`:

```ts
import { BasePropertyType } from '../base.schemas';
import { buildColumnSpecs, SYSTEM_COLUMNS } from './column-types';

const p = (type: string, extra: Record<string, unknown> = {}) => ({
  id: `prop-${type}`,
  type,
  typeOptions: extra,
}) as any;

describe('buildColumnSpecs', () => {
  it('includes the fixed system columns first', () => {
    const specs = buildColumnSpecs([]);
    expect(specs.map((s) => s.column)).toEqual(SYSTEM_COLUMNS.map((s) => s.column));
  });

  it('maps text / url / email to VARCHAR indexable', () => {
    for (const t of [BasePropertyType.TEXT, BasePropertyType.URL, BasePropertyType.EMAIL]) {
      const specs = buildColumnSpecs([p(t)]);
      const user = specs[specs.length - 1];
      expect(user.ddlType).toBe('VARCHAR');
      expect(user.indexable).toBe(true);
    }
  });

  it('maps number to DOUBLE indexable', () => {
    const specs = buildColumnSpecs([p(BasePropertyType.NUMBER)]);
    const user = specs[specs.length - 1];
    expect(user.ddlType).toBe('DOUBLE');
    expect(user.indexable).toBe(true);
  });

  it('maps date to TIMESTAMPTZ indexable', () => {
    const specs = buildColumnSpecs([p(BasePropertyType.DATE)]);
    const user = specs[specs.length - 1];
    expect(user.ddlType).toBe('TIMESTAMPTZ');
    expect(user.indexable).toBe(true);
  });

  it('maps checkbox to BOOLEAN indexable', () => {
    const specs = buildColumnSpecs([p(BasePropertyType.CHECKBOX)]);
    const user = specs[specs.length - 1];
    expect(user.ddlType).toBe('BOOLEAN');
  });

  it('maps select / status to VARCHAR indexable', () => {
    for (const t of [BasePropertyType.SELECT, BasePropertyType.STATUS]) {
      const specs = buildColumnSpecs([p(t)]);
      const user = specs[specs.length - 1];
      expect(user.ddlType).toBe('VARCHAR');
      expect(user.indexable).toBe(true);
    }
  });

  it('maps multiSelect / file / multi-person to JSON non-indexable', () => {
    for (const t of [BasePropertyType.MULTI_SELECT, BasePropertyType.FILE]) {
      const specs = buildColumnSpecs([p(t)]);
      const user = specs[specs.length - 1];
      expect(user.ddlType).toBe('JSON');
      expect(user.indexable).toBe(false);
    }
    const specs = buildColumnSpecs([p(BasePropertyType.PERSON, { allowMultiple: true })]);
    expect(specs[specs.length - 1].ddlType).toBe('JSON');
  });

  it('maps single-person to VARCHAR indexable when allowMultiple=false', () => {
    const specs = buildColumnSpecs([p(BasePropertyType.PERSON, { allowMultiple: false })]);
    const user = specs[specs.length - 1];
    expect(user.ddlType).toBe('VARCHAR');
    expect(user.indexable).toBe(true);
  });

  it('skips unknown property types', () => {
    const specs = buildColumnSpecs([p('unknown-type-x')]);
    expect(specs.length).toBe(SYSTEM_COLUMNS.length);
  });
});
```

Run:
```bash
pnpm --filter server exec jest src/core/base/query-cache/column-types.spec.ts
```

Expected: tests fail — `column-types.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `apps/server/src/core/base/query-cache/column-types.ts`:

```ts
import { BasePropertyType, BasePropertyTypeValue } from '../base.schemas';
import { ColumnSpec } from './query-cache.types';
import type { BaseProperty } from '@docmost/db/types/entity.types';

export const SYSTEM_COLUMNS: ColumnSpec[] = [
  { column: 'id', ddlType: 'VARCHAR', indexable: false },
  { column: 'position', ddlType: 'VARCHAR', indexable: true },
  { column: 'created_at', ddlType: 'TIMESTAMPTZ', indexable: true },
  { column: 'updated_at', ddlType: 'TIMESTAMPTZ', indexable: true },
  { column: 'last_updated_by_id', ddlType: 'VARCHAR', indexable: true },
  { column: 'deleted_at', ddlType: 'TIMESTAMPTZ', indexable: false },
  { column: 'search_text', ddlType: 'VARCHAR', indexable: false },
];

type PropertyLike = Pick<BaseProperty, 'id' | 'type' | 'typeOptions'>;

export function buildColumnSpecs(properties: PropertyLike[]): ColumnSpec[] {
  const out: ColumnSpec[] = [...SYSTEM_COLUMNS];
  for (const prop of properties) {
    const spec = buildUserColumn(prop);
    if (spec) out.push(spec);
  }
  return out;
}

function buildUserColumn(prop: PropertyLike): ColumnSpec | null {
  const t = prop.type as BasePropertyTypeValue;
  switch (t) {
    case BasePropertyType.TEXT:
    case BasePropertyType.URL:
    case BasePropertyType.EMAIL:
      return { column: prop.id, ddlType: 'VARCHAR', indexable: true, property: prop };
    case BasePropertyType.NUMBER:
      return { column: prop.id, ddlType: 'DOUBLE', indexable: true, property: prop };
    case BasePropertyType.DATE:
      return { column: prop.id, ddlType: 'TIMESTAMPTZ', indexable: true, property: prop };
    case BasePropertyType.CHECKBOX:
      return { column: prop.id, ddlType: 'BOOLEAN', indexable: true, property: prop };
    case BasePropertyType.SELECT:
    case BasePropertyType.STATUS:
      return { column: prop.id, ddlType: 'VARCHAR', indexable: true, property: prop };
    case BasePropertyType.MULTI_SELECT:
    case BasePropertyType.FILE:
      return { column: prop.id, ddlType: 'JSON', indexable: false, property: prop };
    case BasePropertyType.PERSON: {
      const allowMultiple = !!(prop.typeOptions as any)?.allowMultiple;
      return allowMultiple
        ? { column: prop.id, ddlType: 'JSON', indexable: false, property: prop }
        : { column: prop.id, ddlType: 'VARCHAR', indexable: true, property: prop };
    }
    // System types are modelled as system columns on base_rows — do not add
    // a per-property column for them. They're already in SYSTEM_COLUMNS.
    case BasePropertyType.CREATED_AT:
    case BasePropertyType.LAST_EDITED_AT:
    case BasePropertyType.LAST_EDITED_BY:
      return null;
    default:
      return null;
  }
}
```

Run the same jest command. Expected: `Tests: 9 passed, 9 total` (one per `it(...)` block in the spec).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/core/base/query-cache/
git commit -m "feat(server): add property-type to DuckDB column-spec mapping"
```

---

## Task 3: Scaffold the query-cache module (wired but dormant)

**Files:**
- Create: `apps/server/src/core/base/query-cache/query-cache.config.ts`
- Create: `apps/server/src/core/base/query-cache/base-query-cache.service.ts` (stub)
- Create: `apps/server/src/core/base/query-cache/base-query-router.ts` (stub returning "use postgres")
- Create: `apps/server/src/core/base/query-cache/query-cache.module.ts`
- Modify: `apps/server/src/core/base/base.module.ts`

Purpose: get the module imported and providers resolvable end-to-end with the flag off. No DuckDB code path yet. This is the "ship it dark" commit.

- [ ] **Step 1: Write the config provider**

Create `apps/server/src/core/base/query-cache/query-cache.config.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

export type QueryCacheConfig = {
  enabled: boolean;
  minRows: number;
  maxCollections: number;
  warmTopN: number;
};

@Injectable()
export class QueryCacheConfigProvider {
  readonly config: QueryCacheConfig;
  constructor(env: EnvironmentService) {
    this.config = {
      enabled: env.getBaseQueryCacheEnabled(),
      minRows: env.getBaseQueryCacheMinRows(),
      maxCollections: env.getBaseQueryCacheMaxCollections(),
      warmTopN: env.getBaseQueryCacheWarmTopN(),
    };
  }
}
```

- [ ] **Step 2: Write the service stub**

Create `apps/server/src/core/base/query-cache/base-query-cache.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';

@Injectable()
export class BaseQueryCacheService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BaseQueryCacheService.name);

  constructor(private readonly configProvider: QueryCacheConfigProvider) {}

  async onApplicationBootstrap(): Promise<void> {
    const { enabled } = this.configProvider.config;
    this.logger.log(
      `BaseQueryCacheService bootstrapped (enabled=${enabled}).`,
    );
    // Real warm-up is added in task 9.
  }

  async onModuleDestroy(): Promise<void> {
    // Real cleanup is added in task 5.
  }
}
```

- [ ] **Step 3: Write the router stub**

Create `apps/server/src/core/base/query-cache/base-query-router.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';

export type RouteDecision = 'postgres' | 'cache';

@Injectable()
export class BaseQueryRouter {
  constructor(private readonly configProvider: QueryCacheConfigProvider) {}

  // Stubbed: routes always to postgres in this commit so the existing
  // behavior is preserved. Real decision logic is added in task 6.
  decide(_args: unknown): RouteDecision {
    if (!this.configProvider.config.enabled) return 'postgres';
    return 'postgres';
  }
}
```

- [ ] **Step 4: Write the module**

Create `apps/server/src/core/base/query-cache/query-cache.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';
import { BaseQueryCacheService } from './base-query-cache.service';
import { BaseQueryRouter } from './base-query-router';

@Module({
  providers: [QueryCacheConfigProvider, BaseQueryCacheService, BaseQueryRouter],
  exports: [BaseQueryCacheService, BaseQueryRouter, QueryCacheConfigProvider],
})
export class BaseQueryCacheModule {}
```

- [ ] **Step 5: Import into BaseModule**

Modify `apps/server/src/core/base/base.module.ts` — add the new module to `imports`:

```ts
import { BaseQueryCacheModule } from './query-cache/query-cache.module';
// ...
@Module({
  imports: [
    BullModule.registerQueue({ name: QueueName.BASE_QUEUE }),
    BaseQueryCacheModule,
  ],
  // ... controllers, providers, exports unchanged
})
export class BaseModule {}
```

- [ ] **Step 6: Build and boot (no run)**

```bash
pnpm nx run server:build
```

Expected: build succeeds. The module compiles and providers resolve. (The `enabled=false` boot log is only observable when the server is actually run, which is out of scope for this build-only step.)

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/core/base/query-cache/ apps/server/src/core/base/base.module.ts
git commit -m "feat(server): scaffold base query-cache module behind feature flag"
```

---

## Task 4: Pure DuckDB query builder (translate engine specs to DuckDB SQL)

**Files:**
- Create: `apps/server/src/core/base/query-cache/duckdb-query-builder.ts`
- Create: `apps/server/src/core/base/query-cache/duckdb-query-builder.spec.ts`

This is the second pure, unit-testable component. No DuckDB runtime required; we just produce a `{ sql, params }` pair that the service will execute later.

- [ ] **Step 1: Test contract**

The builder takes:
- A column set (`ColumnSpec[]` from `buildColumnSpecs`).
- A `FilterNode | undefined`, `SortSpec[] | undefined`, `SearchSpec | undefined` (from `core/base/engine/schema.zod`).
- A `{ limit, afterKeys? }` pagination block, where `afterKeys` is the decoded cursor from the existing `makeCursor` helper.

It returns `{ sql: string; params: unknown[] }`. The SQL must:
- Always project columns in the canonical `BaseRow` shape (id, base_id, cells-as-synthesized-json, position, creator_id, last_updated_by_id, workspace_id, created_at, updated_at, deleted_at, plus each sort-field alias `s0/s1/...` for cursor pagination).
- Filter `deleted_at IS NULL`.
- Apply search / filter / sort via the same precedence the Postgres engine uses.
- Order by `(s0, s1, ..., position, id)` ascending by default, with sort direction honored per field.
- For keyset pagination, emit the lexicographic OR-chain that `cursor-pagination.ts` builds.
- `LIMIT ? + 1` so the caller can detect `hasNextPage`.

Create `apps/server/src/core/base/query-cache/duckdb-query-builder.spec.ts` with the following test cases (write them first, then implement):

```ts
import { buildColumnSpecs } from './column-types';
import { buildDuckDbListQuery } from './duckdb-query-builder';
import { BasePropertyType } from '../base.schemas';

const numericProp = {
  id: '00000000-0000-0000-0000-000000000001',
  type: BasePropertyType.NUMBER,
  typeOptions: {},
} as any;
const textProp = {
  id: '00000000-0000-0000-0000-000000000002',
  type: BasePropertyType.TEXT,
  typeOptions: {},
} as any;

const columns = buildColumnSpecs([numericProp, textProp]);

describe('buildDuckDbListQuery', () => {
  it('renders no-filter, no-sort, no-search as live-rows-paginated-by-position', () => {
    const { sql, params } = buildDuckDbListQuery({
      columns,
      pagination: { limit: 100 },
    });
    expect(sql).toMatch(/FROM rows/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/ORDER BY position ASC, id ASC/);
    expect(sql).toMatch(/LIMIT 101/);
    expect(params).toEqual([]);
  });

  it('renders numeric gt filter with parameterized value', () => {
    const { sql, params } = buildDuckDbListQuery({
      columns,
      filter: {
        op: 'and',
        children: [{ propertyId: numericProp.id, op: 'gt', value: 42 }],
      },
      pagination: { limit: 100 },
    });
    expect(sql).toMatch(new RegExp(`"${numericProp.id}" > \\?`));
    expect(params).toContain(42);
  });

  it('renders text contains with ILIKE and escaped wildcards', () => {
    const { sql, params } = buildDuckDbListQuery({
      columns,
      filter: {
        op: 'and',
        children: [{ propertyId: textProp.id, op: 'contains', value: 'a_b%c' }],
      },
      pagination: { limit: 100 },
    });
    expect(sql).toMatch(/ILIKE \?/);
    expect(params).toContain('%a\\_b\\%c%');
  });

  it('renders sort with sentinel wrapping and cursor keyset', () => {
    const { sql } = buildDuckDbListQuery({
      columns,
      sorts: [{ propertyId: numericProp.id, direction: 'asc' }],
      pagination: {
        limit: 50,
        afterKeys: { s0: 10, position: 'A0', id: '00000000-0000-0000-0000-0000000000aa' },
      },
    });
    expect(sql).toMatch(/COALESCE\("[0-9a-f-]+", '?[Ii]nfinity'?::[A-Z]+\) AS s0/);
    expect(sql).toMatch(/ORDER BY s0 ASC, position ASC, id ASC/);
    // keyset OR-chain
    expect(sql).toMatch(/s0 > \?/);
  });

  it('renders search in trgm mode as ILIKE on search_text', () => {
    const { sql, params } = buildDuckDbListQuery({
      columns,
      search: { mode: 'trgm', query: 'hello' },
      pagination: { limit: 10 },
    });
    expect(sql).toMatch(/search_text ILIKE \?/);
    expect(params).toContain('%hello%');
  });
});
```

Run:
```bash
pnpm --filter server exec jest src/core/base/query-cache/duckdb-query-builder.spec.ts
```

Expected: fails (builder not implemented).

- [ ] **Step 2: Implement the builder**

Create `apps/server/src/core/base/query-cache/duckdb-query-builder.ts`. The implementation mirrors the Postgres engine in `apps/server/src/core/base/engine/predicate.ts`, `sort.ts`, `search.ts`, but emits DuckDB SQL with `?` positional params.

Structure (no code dump — follow the Postgres engine's kind-dispatch exactly):

- `buildDuckDbListQuery(opts)` entry point.
- `buildFilter(node, columns, params) -> string` — recurse into FilterGroup, emit `(A AND B)` / `(A OR B)`, or call `buildCondition`.
- `buildCondition(cond, col, params) -> string` — kind-dispatch on `col.property.type` via `propertyKind`, with the same operator tables as predicate.ts but using DuckDB syntax:
  - text contains / startsWith / endsWith → `ILIKE ?` with the `escapeIlike` helper already in `engine/extractors.ts` (reuse it verbatim).
  - numeric / date comparisons → `<op> ?`.
  - bool `eq` / `neq` → `<op> ?`.
  - select `any` → `"col" IN (?, ?, ?)`.
  - multi/file `any` → `json_array_contains(<col>, ?)` OR chain.
  - multi/file `all` → repeated `json_array_contains` AND chain.
  - isEmpty / isNotEmpty → `IS NULL` / `IS NOT NULL` (+ the empty-string leg for text).
- `buildSort(sorts, columns) -> {select: string[], orderBy: string}`:
  - Mirror `sort.ts wrapWithSentinel` — wrap each sort expression in `COALESCE(<col>, <sentinel>)` aliased `sN`. Sentinels: numeric → `'Infinity'::DOUBLE` / `'-Infinity'::DOUBLE`; date → `'9999-12-31 23:59:59+00'::TIMESTAMPTZ` / `'0001-01-01 00:00:00+00'::TIMESTAMPTZ`; bool → `TRUE` / `FALSE`; text → `CHR(1114111)` / `''`.
  - Append tail `position, id` — unchanged.
- `buildSearch(search) -> string` — `trgm` → `search_text ILIKE ?` with the escape; `fts` → throw a typed sentinel exception `FtsNotSupportedInCache` so the router falls through to Postgres.
- `buildKeyset(afterKeys, sortAliases, columns) -> string` — the same OR-chain `cursor-pagination.ts` produces, but in DuckDB SQL with `?` params. Important: the cursor key names (`s0, s1, ..., position, id`) match the engine.

DuckDB parameter placeholder is `?` (positional) via `@duckdb/node-api` — no named params needed.

Run jest again; all tests should pass.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/base/query-cache/duckdb-query-builder.ts apps/server/src/core/base/query-cache/duckdb-query-builder.spec.ts
git commit -m "feat(server): add DuckDB SQL builder for base list queries"
```

---

## Task 5: Collection loader + in-memory cache + list() path (still off by default)

**Files:**
- Create: `apps/server/src/core/base/query-cache/collection-loader.ts`
- Modify: `apps/server/src/core/base/query-cache/base-query-cache.service.ts`
- Create: `apps/server/src/core/base/query-cache/base-query-cache.integration.spec.ts`

This is the first real DuckDB code path. The integration spec needs a real Postgres (via the existing `DATABASE_URL`) and does not need Redis (we don't wire the subscriber here). Gate the spec on `process.env.INTEGRATION_DB_URL` being set so CI can run the whole suite and local devs can run just unit tests.

- [ ] **Step 1: Add `BaseRowRepo.countActiveRows`**

Modify `apps/server/src/database/repos/base/base-row.repo.ts` — append:

```ts
  async countActiveRows(
    baseId: string,
    opts: WorkspaceOpts,
  ): Promise<number> {
    const db = dbOrTx(this.db, opts.trx);
    const row = await db
      .selectFrom('baseRows')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('baseId', '=', baseId)
      .where('workspaceId', '=', opts.workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }
```

- [ ] **Step 2: Implement `CollectionLoader`**

Create `apps/server/src/core/base/query-cache/collection-loader.ts`:

- Inject `BasePropertyRepo`, `BaseRowRepo`, `BaseRepo`.
- Expose one method: `async load(baseId: string, workspaceId: string): Promise<LoadedCollection>`.
- Implementation outline:
  1. Fetch `bases.schemaVersion` + all properties.
  2. `const specs = buildColumnSpecs(properties);`
  3. `const instance = await DuckDBInstance.create(':memory:');` then `const connection = await instance.connect();`.
  4. `CREATE TABLE rows (<specs mapped to DDL>, PRIMARY KEY (id))`. Wrap each column name in `"..."`.
  5. Bulk-insert rows using the **DuckDB Appender API** (`connection.createAppender('rows')`). The appender is DuckDB's idiomatic high-throughput insert path — it skips SQL parsing per row, accepts typed column values positionally in declared column order, and flushes on `closeSync()`. Prepared `INSERT` with re-binding works too but is 5–10× slower for wide tables; the appender is the right default for cold load of 100K rows.

     Stream rows via `baseRowRepo.streamByBaseId(baseId, { workspaceId, chunkSize: 5000 })`. For each row:

     ```ts
     // appender column order matches specs[] order (CREATE TABLE declared order)
     for (const spec of specs) {
       const raw = readFromRow(row, spec); // system field or row.cells[prop.id]
       if (raw == null) {
         appender.appendNull();
         continue;
       }
       switch (spec.ddlType) {
         case 'VARCHAR':
           appender.appendVarchar(String(raw));
           break;
         case 'DOUBLE': {
           const n = Number(raw);
           if (Number.isNaN(n)) { appender.appendNull(); break; }
           appender.appendDouble(n);
           break;
         }
         case 'BOOLEAN':
           appender.appendBoolean(Boolean(raw));
           break;
         case 'TIMESTAMPTZ': {
           // bindTimestampTZ / appendTimestampTZ take DuckDBTimestampTZValue.
           // Cheapest path is to format as ISO8601 and append as VARCHAR into
           // a TIMESTAMPTZ column — DuckDB casts implicitly. If profiling
           // shows this is a bottleneck, switch to DuckDBTimestampTZValue via
           // `new DuckDBTimestampTZValue(microsSinceEpoch)`.
           const d = raw instanceof Date ? raw : new Date(String(raw));
           if (Number.isNaN(d.getTime())) { appender.appendNull(); break; }
           appender.appendVarchar(d.toISOString());
           break;
         }
         case 'JSON':
           // JSON columns in DuckDB accept a VARCHAR containing JSON text.
           appender.appendVarchar(JSON.stringify(raw));
           break;
       }
     }
     appender.endRow();
     ```

     After the stream drains: `appender.flushSync(); appender.closeSync();`.

     Notes:
     - System columns: use the row's direct fields (`id`, `position`, `createdAt`, `updatedAt`, `lastUpdatedById`, `null` for `deleted_at`, `''` for `search_text` — we leave `search_text` unpopulated in v1; search stays on Postgres until task 4's `FtsNotSupportedInCache` sentinel drives us back, and even trgm search against an unpopulated column returns no rows — so route trgm search to Postgres as well in v1, see task 6).
     - Malformed values log at debug level and become `null`.
  6. For each indexable column: `CREATE INDEX idx_<safeCol> ON rows ("<col>");`. The PK already indexes `id`.
  7. Return `{ baseId, schemaVersion, columns: specs, instance, connection, lastAccessedAt: Date.now() }`.

Rationale for `:memory:` DuckDB per base: isolation, easy eviction (just close the instance), no disk file management. Memory overhead per collection is roughly `(columns * rows * avgBytes)` — a 100K-row base with 15 indexed columns is well under 100 MB.

- [ ] **Step 3: Wire cache service**

Replace the stub in `base-query-cache.service.ts` with a real Map + LRU + `list()` method:

- Private `collections = new Map<string, LoadedCollection>()`.
- Public `list(baseId: string, workspaceId: string, engineOpts: EngineListOpts): Promise<CursorPaginationResult<BaseRow>>` — calls `ensureLoaded`, builds SQL + positional params via `buildDuckDbListQuery`, then executes via the DuckDB Neo prepared-statement API (DuckDB Neo's `runAndReadAll` on a `DuckDBConnection` does NOT take a params array — parameterization goes through `connection.prepare(sql)` and per-type `bind*` calls). The shape is:

  ```ts
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
      // ISO string into a TIMESTAMPTZ column casts implicitly; see the
      // loader's TIMESTAMPTZ handling above for the rationale.
      prepared.bindVarchar(oneBased, p.toISOString());
    } else {
      // Fallback: serialize complex values as JSON text for JSON columns.
      prepared.bindVarchar(oneBased, JSON.stringify(p));
    }
  }
  const reader = await prepared.runAndReadAll();
  const rows = reader.getRowObjects(); // use getRowObjects consistently so the
                                       // row-shaping code can read by column name
  ```

  Then shape rows into `BaseRow[]`, handle `LIMIT+1` → `hasNextPage`, and encode cursors using the existing `makeCursor` helper so the output is byte-identical to Postgres.
- Private `ensureLoaded(baseId, workspaceId)` — hit map, compare `schemaVersion` from a cheap `bases.findById` against the cached one; on miss or stale, call loader. Update `lastAccessedAt`. On cap exceeded, evict least-recently-used (single-pass scan of map is fine for ≤1000 entries; a `LinkedHashMap` is overkill).
- Public `invalidate(baseId)` — close the connection + instance if resident; remove from map.
- `onModuleDestroy` closes all collections.

- [ ] **Step 4a: Extract a reusable seeding helper**

The seed script currently runs as a standalone process (`apps/server/src/scripts/seed-base-rows.ts`). Before writing the integration spec, extract its base + property + row generation into a module-exportable helper that both the script and the test can call. This is a prerequisite — no such helper exists in the repo today (verified 2026-04-19 — the repo has no `*.integration.spec.ts` files and no test-seeding helpers under `apps/server/test/`).

Create `apps/server/src/core/base/query-cache/testing/seed-base.ts`:

```ts
import type { Kysely } from 'kysely';
import { v7 as uuid7 } from 'uuid';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
// Re-use the deterministic generators from seed-base-rows.ts by exporting
// them from that file (move WORDS/COLORS/randomWords etc. above a new
// `export` keyword, leaving the top-level script body intact).

export type SeedBaseOptions = {
  db: Kysely<any>;
  workspaceId: string;
  spaceId: string;
  creatorUserId: string;
  rows: number;
  name?: string;
};

export type SeededBase = {
  baseId: string;
  propertyIds: {
    text: string;
    number: string;
    status: string;
    date: string;
    // ... whichever props the script emits
  };
};

export async function seedBase(opts: SeedBaseOptions): Promise<SeededBase> {
  // Move the guts of the existing seed-base-rows.ts top-level body here.
  // Keep the RNG deterministic (seed with opts.name + opts.rows) so tests
  // are reproducible across machines.
}

export async function deleteSeededBase(
  db: Kysely<any>,
  baseId: string,
): Promise<void> {
  // DELETE rows first, then properties, views, then the base, matching
  // the hard-delete order the existing cleanup script uses.
}
```

Also update `apps/server/src/scripts/seed-base-rows.ts` to be a thin wrapper that calls `seedBase({ ... })` so `TOTAL_ROWS=10000 tsx src/scripts/seed-base-rows.ts` still works.

- [ ] **Step 4b: Integration test — single-collection loader round-trip**

Create `apps/server/src/core/base/query-cache/base-query-cache.integration.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { KyselyModule, InjectKysely } from '@docmost/db/kysely';
import { BaseModule } from '../base.module';
import { BaseQueryCacheService } from './base-query-cache.service';
import { BaseRowService } from '../services/base-row.service';
import { seedBase, deleteSeededBase } from './testing/seed-base';

// Skip the suite when no integration DB is wired. Run locally with:
//   INTEGRATION_DB_URL=$DATABASE_URL pnpm --filter server exec jest \
//     src/core/base/query-cache/base-query-cache.integration.spec.ts
const describeIfIntegration = process.env.INTEGRATION_DB_URL
  ? describe
  : describe.skip;

describeIfIntegration('BaseQueryCacheService (integration)', () => {
  let module: TestingModule;
  let cache: BaseQueryCacheService;
  let rowService: BaseRowService;
  let db: any;
  let workspaceId: string;
  let spaceId: string;
  let userId: string;
  let seededBaseId: string;

  beforeAll(async () => {
    // Minimal real-module bootstrap. We import BaseModule (which now
    // imports BaseQueryCacheModule via Task 3) plus the infra modules it
    // depends on. We rely on process.env.INTEGRATION_DB_URL (aliased to
    // DATABASE_URL) being set; without it the whole describe is skipped.
    process.env.DATABASE_URL = process.env.INTEGRATION_DB_URL;
    process.env.BASE_QUERY_CACHE_ENABLED = 'true';
    process.env.BASE_QUERY_CACHE_MIN_ROWS = '100'; // so a 10K seed counts as "large"

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        KyselyModule.forRoot(), // uses DATABASE_URL
        BaseModule,
      ],
    }).compile();

    cache = module.get(BaseQueryCacheService);
    rowService = module.get(BaseRowService);
    db = module.get('KYSELY_DB'); // the token the repo uses for InjectKysely

    // These three IDs must exist in the test database. Prefer to seed them
    // in a one-time `globalSetup` script if the CI DB is empty; for a
    // developer machine pointing at their dev DB, look them up from any
    // existing workspace/space/user.
    const anyWorkspace = await db
      .selectFrom('workspaces')
      .select(['id'])
      .limit(1)
      .executeTakeFirstOrThrow();
    const anySpace = await db
      .selectFrom('spaces')
      .select(['id'])
      .where('workspaceId', '=', anyWorkspace.id)
      .limit(1)
      .executeTakeFirstOrThrow();
    const anyUser = await db
      .selectFrom('users')
      .select(['id'])
      .where('workspaceId', '=', anyWorkspace.id)
      .limit(1)
      .executeTakeFirstOrThrow();
    workspaceId = anyWorkspace.id;
    spaceId = anySpace.id;
    userId = anyUser.id;

    const seeded = await seedBase({
      db,
      workspaceId,
      spaceId,
      creatorUserId: userId,
      rows: 10_000,
      name: 'query-cache-integration',
    });
    seededBaseId = seeded.baseId;
  }, /* boot + seed timeout */ 120_000);

  afterAll(async () => {
    if (seededBaseId) await deleteSeededBase(db, seededBaseId);
    await module?.close();
  });

  it('paginates a numeric sort identically to Postgres', async () => {
    const numberPropId = /* look up from seeded.propertyIds.number */ '';
    const args = {
      sorts: [{ propertyId: numberPropId, direction: 'asc' as const }],
      pagination: { limit: 500 },
    };

    const pgPages: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await rowService.list(
        { baseId: seededBaseId, ...args },
        { limit: args.pagination.limit, cursor },
        workspaceId,
      );
      pgPages.push(...page.items.map((r) => r.id));
      cursor = page.nextCursor;
    } while (cursor);

    const dkPages: string[] = [];
    cursor = undefined;
    do {
      const page = await cache.list(seededBaseId, workspaceId, {
        ...args,
        pagination: { limit: args.pagination.limit, cursor },
      });
      dkPages.push(...page.items.map((r) => r.id));
      cursor = page.nextCursor;
    } while (cursor);

    expect(dkPages).toEqual(pgPages);
    expect(dkPages.length).toBe(10_000);
  }, /* query timeout */ 60_000);
});
```

Two things the executor MUST verify before running the test:
1. The `KyselyModule` / `InjectKysely` token and the `'KYSELY_DB'` string literal above are placeholders — the real token is defined in `packages/db/src/kysely/` (or wherever `@docmost/db` lives); look it up and substitute.
2. `rowService.list` signature above matches the real one after Task 6's edits; re-check argument shape at test-write time.

Run with:

```bash
INTEGRATION_DB_URL=$DATABASE_URL pnpm --filter server exec jest src/core/base/query-cache/base-query-cache.integration.spec.ts
```

Expected: `Tests: 1 passed, 1 total`. Without `INTEGRATION_DB_URL` the whole describe is skipped, so local unit-test runs stay fast.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/core/base/query-cache/collection-loader.ts \
        apps/server/src/core/base/query-cache/base-query-cache.service.ts \
        apps/server/src/core/base/query-cache/base-query-cache.integration.spec.ts \
        apps/server/src/core/base/query-cache/testing/seed-base.ts \
        apps/server/src/database/repos/base/base-row.repo.ts \
        apps/server/src/scripts/seed-base-rows.ts
git commit -m "feat(server): load bases into DuckDB and serve list queries from cache"
```

---

## Task 6: Router — decide between Postgres and DuckDB paths; wire into BaseRowService

**Files:**
- Modify: `apps/server/src/core/base/query-cache/base-query-router.ts`
- Create: `apps/server/src/core/base/query-cache/base-query-router.spec.ts`
- Modify: `apps/server/src/core/base/services/base-row.service.ts`

- [ ] **Step 1: Write failing unit tests for the router**

Create `apps/server/src/core/base/query-cache/base-query-router.spec.ts`. Cases (all pure, no DB — use a fake config provider and a fake row-count function):

```ts
describe('BaseQueryRouter.decide', () => {
  it('returns postgres when flag is off', () => { /* ... */ });
  it('returns postgres when row count < minRows', () => { /* ... */ });
  it('returns postgres when query has no filter/sort/search', () => { /* ... */ });
  it('returns postgres when search.mode === "fts" even for large base', () => { /* ... */ });
  it('returns cache when flag on + rows >= minRows + has filter', () => { /* ... */ });
  it('returns cache when flag on + rows >= minRows + has sort', () => { /* ... */ });
  it('returns cache when flag on + rows >= minRows + has trgm search', () => { /* ... */ });
});
```

Run:
```bash
pnpm --filter server exec jest src/core/base/query-cache/base-query-router.spec.ts
```

Expected: fails (router still stubbed).

- [ ] **Step 2: Implement the real router**

Replace stub in `base-query-router.ts`:

```ts
@Injectable()
export class BaseQueryRouter {
  constructor(
    private readonly configProvider: QueryCacheConfigProvider,
    private readonly baseRowRepo: BaseRowRepo,
  ) {}

  async decide(args: {
    baseId: string;
    workspaceId: string;
    filter?: FilterNode;
    sorts?: SortSpec[];
    search?: SearchSpec;
  }): Promise<RouteDecision> {
    const { enabled, minRows } = this.configProvider.config;
    if (!enabled) return 'postgres';

    const hasFilter = !!args.filter;
    const hasSorts = !!args.sorts && args.sorts.length > 0;
    const hasSearch = !!args.search;
    if (!hasFilter && !hasSorts && !hasSearch) return 'postgres';

    // v1: full-text search stays on Postgres. Trgm search also stays on
    // Postgres until we populate search_text in DuckDB; re-evaluate after
    // the loader gains search-column population.
    if (args.search) return 'postgres';

    const count = await this.baseRowRepo.countActiveRows(args.baseId, {
      workspaceId: args.workspaceId,
    });
    if (count < minRows) return 'postgres';

    return 'cache';
  }
}
```

Clarification: trgm search is gated off in v1 because the loader in task 5 does not populate `search_text`. If/when we decide to support trgm in the cache, the loader populates it and this branch relaxes. This is explicitly called out so the executor doesn't implement trgm + loader-population in the same commit and get cross-branch test failures.

- [ ] **Step 3: Wire into `BaseRowService.list`**

Modify `apps/server/src/core/base/services/base-row.service.ts`:

```ts
constructor(
  @InjectKysely() private readonly db: KyselyDB,
  private readonly baseRowRepo: BaseRowRepo,
  private readonly basePropertyRepo: BasePropertyRepo,
  private readonly baseViewRepo: BaseViewRepo,
  private readonly eventEmitter: EventEmitter2,
  private readonly queryRouter: BaseQueryRouter,
  private readonly queryCache: BaseQueryCacheService,
) {}

async list(dto: ListRowsDto, pagination: PaginationOptions, workspaceId: string) {
  const properties = await this.basePropertyRepo.findByBaseId(dto.baseId);
  const schema: PropertySchema = new Map(properties.map((p) => [p.id, p]));

  const filter = this.normaliseFilter(dto);
  const search = this.normaliseSearch(dto.search);
  const sorts = dto.sorts?.map((s) => ({
    propertyId: s.propertyId,
    direction: s.direction,
  }));

  const decision = await this.queryRouter.decide({
    baseId: dto.baseId,
    workspaceId,
    filter,
    sorts,
    search,
  });

  if (decision === 'cache') {
    try {
      return await this.queryCache.list(dto.baseId, workspaceId, {
        filter,
        sorts,
        search,
        schema,
        pagination,
      });
    } catch (err) {
      // Clean fall-through: cache must never surface to the client.
      // Log and let Postgres handle it.
      this.logger.warn(
        `Cache list failed for base ${dto.baseId}, falling back to Postgres`,
        err as Error,
      );
    }
  }

  return this.baseRowRepo.list({
    baseId: dto.baseId,
    workspaceId,
    filter,
    sorts,
    search,
    schema,
    pagination,
  });
}
```

Before the `try/catch` above, ensure `BaseRowService` declares `private readonly logger = new Logger(BaseRowService.name);` as a class field (import `Logger` from `@nestjs/common`). If it doesn't already have one, add it in this same edit — the `this.logger.warn(...)` call in the catch block requires it and we do NOT fall back to optional chaining (`this.logger?.warn?.`) because defensive optional chaining on a class-owned field hides wiring bugs (CLAUDE.md C-7). Also ensure `BaseQueryCacheModule` is imported by `BaseModule` so both providers resolve (done in task 3).

- [ ] **Step 4: Verify router tests pass**

```bash
pnpm --filter server exec jest src/core/base/query-cache/base-query-router.spec.ts
```

Expected: `Tests: 7 passed, 7 total` (one per `it(...)` block in the spec above).

- [ ] **Step 5: Verify build**

```bash
pnpm nx run server:build
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/core/base/query-cache/base-query-router.ts \
        apps/server/src/core/base/query-cache/base-query-router.spec.ts \
        apps/server/src/core/base/services/base-row.service.ts
git commit -m "feat(server): route large base list queries through the duckdb cache"
```

---

## Task 7: Publish change envelopes to Redis, apply on subscribe

**Files:**
- Create: `apps/server/src/core/base/query-cache/base-query-cache.write-consumer.ts`
- Create: `apps/server/src/core/base/query-cache/base-query-cache.subscriber.ts`
- Modify: `apps/server/src/core/base/query-cache/base-query-cache.service.ts` (add `applyChange`)
- Modify: `apps/server/src/core/base/query-cache/query-cache.module.ts`

Pattern matches `BaseWsConsumers` (in-process `@OnEvent` listener) + `BasePresenceService` (ioredis via `RedisService`).

- [ ] **Step 1: Write the Redis publisher**

Create `apps/server/src/core/base/query-cache/base-query-cache.write-consumer.ts`:

All `EventName` identifiers below are defined in `apps/server/src/common/events/event.contants.ts` (verified 2026-04-19). Exact line references: `BASE_ROW_CREATED` L23, `BASE_ROW_UPDATED` L24, `BASE_ROW_DELETED` L25, `BASE_ROWS_DELETED` L26, `BASE_ROW_REORDERED` L28, `BASE_PROPERTY_CREATED` L30, `BASE_PROPERTY_UPDATED` L31, `BASE_PROPERTY_DELETED` L32, `BASE_SCHEMA_BUMPED` L39. No new events need to be added for Task 7.

- Imports `RedisService` from `@nestjs-labs/nestjs-ioredis`; resolves the client in constructor via `redisService.getOrThrow()` (same as `apps/server/src/core/base/realtime/base-presence.service.ts`).
- `@OnEvent(EventName.BASE_ROW_CREATED)` → publish `{ kind: 'row-upsert', baseId, row }`.
- `@OnEvent(EventName.BASE_ROW_UPDATED)` → fetch the updated row from Postgres (full row needed — `patch` alone doesn't carry all columns) and publish `{ kind: 'row-upsert', baseId, row }`. Optimization deferred: pass the row through the event payload (requires an additive tweak to `BaseRowUpdatedEvent` — out of scope for v1; instead, call `baseRowRepo.findById` here).
- `@OnEvent(EventName.BASE_ROW_DELETED)` → `{ kind: 'row-delete', baseId, rowId }`.
- `@OnEvent(EventName.BASE_ROWS_DELETED)` → `{ kind: 'rows-delete', baseId, rowIds }`.
- `@OnEvent(EventName.BASE_ROW_REORDERED)` → `{ kind: 'row-reorder', baseId, rowId, position }`.
- `@OnEvent(EventName.BASE_SCHEMA_BUMPED)` and `@OnEvent(EventName.BASE_PROPERTY_UPDATED)` / `BASE_PROPERTY_CREATED` / `BASE_PROPERTY_DELETED` → `{ kind: 'schema-invalidate', baseId, schemaVersion }`.

Channel: `base-query-cache:changes:${baseId}`. Payload: `JSON.stringify(envelope)`.

Guard with `if (!configProvider.config.enabled) return;` at the top of each handler so the flag-off path pays zero.

- [ ] **Step 2: Write the Redis subscriber**

Create `apps/server/src/core/base/query-cache/base-query-cache.subscriber.ts`:

- Implement `OnApplicationBootstrap` + `OnModuleDestroy`.
- On bootstrap (if flag enabled): create a dedicated ioredis client (NOT the shared one — ioredis pub/sub clients enter subscriber-only mode). `apps/server/src/core/base/realtime/base-presence.service.ts` shows the "shared client" pattern used for regular ops; for a dedicated subscriber use `new Redis(parseRedisUrl(env.getRedisUrl()))` mirroring `apps/server/src/ws/adapter/ws-redis.adapter.ts:16` (`parseRedisUrl` itself is exported from `apps/server/src/common/helpers/utils.ts:35`).
- `PSUBSCRIBE base-query-cache:changes:*`.
- On message: parse envelope, call `cacheService.applyChange(envelope)`. Catch-and-log any parse error.
- On destroy: `quit()` the client.

- [ ] **Step 3: Add `applyChange` to the cache service**

Modify `base-query-cache.service.ts`:

```ts
async applyChange(env: ChangeEnvelope): Promise<void> {
  const collection = this.collections.get(env.baseId);
  if (!collection) return; // not resident on this node, ignore
  try {
    switch (env.kind) {
      case 'schema-invalidate':
        if (env.schemaVersion > collection.schemaVersion) {
          await this.invalidate(env.baseId);
        }
        return;
      case 'row-upsert':
        await this.upsertRow(collection, env.row);
        return;
      case 'row-delete':
        await this.deleteRow(collection, env.rowId);
        return;
      case 'rows-delete':
        for (const id of env.rowIds) await this.deleteRow(collection, id);
        return;
      case 'row-reorder':
        await this.updatePosition(collection, env.rowId, env.position);
        return;
    }
  } catch (err) {
    // On any patch failure, nuke the collection; next read reloads from
    // Postgres. Much safer than running with a partially-patched cache.
    this.logger.warn(`applyChange failed for ${env.baseId}; invalidating`, err);
    await this.invalidate(env.baseId);
  }
}
```

`upsertRow` / `deleteRow` / `updatePosition` use the prepare/bind/run pattern documented in Task 5 Step 3 (DuckDB Neo API):
- `upsertRow`: `INSERT OR REPLACE INTO rows VALUES (?, ?, …)` — prepare once per call, bind each column's value per `specs[i].ddlType` (same coercion table as the loader), then `await prepared.run()`.
- `deleteRow`: only "live rows" are cached; soft-delete → remove. `DELETE FROM rows WHERE id = ?` with `prepared.bindVarchar(1, rowId); await prepared.run();`.
- `updatePosition`: `UPDATE rows SET position = ? WHERE id = ?` with `prepared.bindVarchar(1, position); prepared.bindVarchar(2, rowId); await prepared.run();`.

No params-array shorthand is used anywhere — that signature doesn't exist on `DuckDBConnection`.

- [ ] **Step 4: Register in the module**

Modify `query-cache.module.ts` providers list:

```ts
providers: [
  QueryCacheConfigProvider,
  BaseQueryCacheService,
  BaseQueryRouter,
  CollectionLoader,
  BaseQueryCacheWriteConsumer,
  BaseQueryCacheSubscriber,
],
```

- [ ] **Step 5: Integration test — round-trip of a row-update event**

Extend `base-query-cache.integration.spec.ts` with a test that:

1. Seeds a base.
2. Forces a load via `cache.list(...)`.
3. Directly emits `EventName.BASE_ROW_UPDATED` through the `EventEmitter2` (bypasses Redis — acceptable since the write-consumer still fires, publishing onto Redis, and the subscriber on the same node receives the event).
4. Reads via `cache.list(...)` again, asserts the updated row reflects the patch.

For pure determinism, consider adding a secondary path where `applyChange` is called directly in the test without Redis, but the whole-loop test (Redis included) catches channel-name typos.

Run:
```bash
INTEGRATION_DB_URL=$DATABASE_URL REDIS_URL=$REDIS_URL pnpm --filter server exec jest src/core/base/query-cache/base-query-cache.integration.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/core/base/query-cache/base-query-cache.write-consumer.ts \
        apps/server/src/core/base/query-cache/base-query-cache.subscriber.ts \
        apps/server/src/core/base/query-cache/base-query-cache.service.ts \
        apps/server/src/core/base/query-cache/query-cache.module.ts \
        apps/server/src/core/base/query-cache/base-query-cache.integration.spec.ts
git commit -m "feat(server): propagate row mutations to duckdb cache via redis pubsub"
```

---

## Task 8: LRU eviction — tested with a tight cap

**Files:**
- Modify: `apps/server/src/core/base/query-cache/base-query-cache.service.ts`
- Modify: `apps/server/src/core/base/query-cache/base-query-cache.integration.spec.ts`

Eviction logic from task 5 already scaffolded. This task is about tightening and test coverage.

- [ ] **Step 1: Ensure eviction path is deterministic**

In `ensureLoaded`, after inserting a new collection into the map, if `this.collections.size > this.config.maxCollections`, find the entry with the smallest `lastAccessedAt` and call `invalidate(baseId)` on it. Single loop over map entries (N ≤ 500, trivially cheap).

- [ ] **Step 2: Integration test with cap=2**

Add a test case that:

1. Temporarily creates a cache service instance with `maxCollections = 2` (use a test module override on `QueryCacheConfigProvider`).
2. Seeds 3 bases.
3. Loads all 3 in sequence. After each, verify `collections.size <= 2` and that the eldest-accessed base is NOT resident anymore.
4. Loads the evicted base again — verify it reloads cleanly (schemaVersion comes back, basic query returns rows).

Run:
```bash
INTEGRATION_DB_URL=$DATABASE_URL pnpm --filter server exec jest src/core/base/query-cache/base-query-cache.integration.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/base/query-cache/base-query-cache.service.ts \
        apps/server/src/core/base/query-cache/base-query-cache.integration.spec.ts
git commit -m "feat(server): evict least-recently-used duckdb collections when cap exceeded"
```

---

## Task 9: Warm-on-boot using recent-access Redis sorted set

**Files:**
- Modify: `apps/server/src/core/base/query-cache/base-query-cache.service.ts`

- [ ] **Step 1: Record access**

In `ensureLoaded`, after a successful load or a successful hit, call `this.recordAccess(baseId)` which issues:

```
ZADD base-query-cache:recent <now-ms> <baseId>
ZREMRANGEBYRANK base-query-cache:recent 0 -(maxCollections * 10 + 1)
```

(Fire-and-forget; errors swallowed with debug log.)

- [ ] **Step 2: `onApplicationBootstrap` warm-up**

Replace the stub from task 3:

```ts
async onApplicationBootstrap(): Promise<void> {
  const { enabled, warmTopN } = this.configProvider.config;
  if (!enabled) return;
  try {
    const ids = await this.redis.zrevrange('base-query-cache:recent', 0, warmTopN - 1);
    for (const baseId of ids) {
      try {
        const base = await this.baseRepo.findById(baseId);
        if (!base) continue;
        await this.ensureLoaded(baseId, base.workspaceId);
      } catch (err) {
        this.logger.debug(`warm-up skipped ${baseId}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`Warmed ${ids.length} collections on boot`);
  } catch (err) {
    this.logger.warn('Warm-up failed', err as Error);
  }
}
```

Warm-up is sequential intentionally: parallel warming of 50 bases each reading 25K rows from Postgres overwhelms the pool on boot.

- [ ] **Step 3: Integration test**

Add a test case:

1. Access base A via `cache.list` (forces a ZADD).
2. Destroy the service instance (simulating node restart).
3. New instance with warm-up enabled. Assert base A is resident in the Map before any explicit `list` call.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/core/base/query-cache/base-query-cache.service.ts \
        apps/server/src/core/base/query-cache/base-query-cache.integration.spec.ts
git commit -m "feat(server): warm duckdb collections on boot from redis recent-access set"
```

---

## Task 10: End-to-end correctness — 100K seed base, cache vs postgres row-for-row

**Files:**
- Modify: `apps/server/src/core/base/query-cache/base-query-cache.integration.spec.ts`

This is the correctness gate for merge.

- [ ] **Step 1: Add the scale test, skipped by default**

```ts
const itIfScale = process.env.INTEGRATION_DB_URL && process.env.SCALE_TEST === 'true' ? it : it.skip;

itIfScale('100K base: cache and postgres return identical rows for common queries', async () => {
  // Reuses the `seedBase` helper extracted in Task 5 Step 4a
  // (apps/server/src/core/base/query-cache/testing/seed-base.ts).
  const { baseId } = await seedBase({
    db,
    workspaceId: WS,
    spaceId: SPACE,
    creatorUserId: USER,
    rows: 100_000,
    name: 'query-cache-scale',
  });
  const queries = [
    { sorts: [{ propertyId: PROP_NUMBER, direction: 'asc' }] },
    { sorts: [{ propertyId: PROP_TEXT, direction: 'desc' }] },
    { filter: { op: 'and', children: [{ propertyId: PROP_STATUS, op: 'eq', value: DONE_ID }] } },
    {
      filter: { op: 'and', children: [{ propertyId: PROP_BUDGET, op: 'gt', value: 5000 }] },
      sorts: [{ propertyId: PROP_DATE, direction: 'desc' }],
    },
  ];
  for (const q of queries) {
    const pgAll = await collectAllPages(() => baseRowService.list(q /*, postgres-forced */));
    const dkAll = await collectAllPages(() => cacheService.list(baseId, WS, q));
    expect(dkAll.map(r => r.id)).toEqual(pgAll.map(r => r.id));
  }
}, /* 5min timeout */ 300_000);
```

Run:
```bash
INTEGRATION_DB_URL=$DATABASE_URL SCALE_TEST=true pnpm --filter server exec jest src/core/base/query-cache/base-query-cache.integration.spec.ts
```

Expected: passes; typical run-time 2–5 min (seed + 4 full-traversal comparisons).

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/core/base/query-cache/base-query-cache.integration.spec.ts
git commit -m "test(server): assert duckdb cache matches postgres on a 100K-row base"
```

---

## Rollout checklist

Phased exposure. Each phase is its own PR-sized change — do NOT skip ahead.

1. **Ship dark.** Merge all tasks above with `BASE_QUERY_CACHE_ENABLED=false` in production env. Verify in metrics that `POST /bases/rows` latency and error rate are unchanged (this is the "does the scaffold actually cost nothing when off" check). Wait one full week of production traffic.

2. **Opt-in per workspace.** Before enabling globally, wire a check in `BaseQueryRouter.decide` that consults a small allow-list of workspace IDs (env var `BASE_QUERY_CACHE_WORKSPACE_IDS=ws1,ws2`). Set it to one internal workspace. Monitor:
   - p50/p95/p99 latency of `/bases/rows` for the pilot workspace.
   - Cache hit rate (log `decision === 'cache'` counter).
   - Any log line from `BaseRowService.list`'s cache-path catch block (should be zero under normal operation).

3. **Enable globally.** Drop the allow-list, set `BASE_QUERY_CACHE_ENABLED=true` everywhere. Watch `/bases/rows` p99, memory RSS (DuckDB pages stay in-process), and Redis pub/sub throughput. If RSS climbs beyond expectations, reduce `BASE_QUERY_CACHE_MAX_COLLECTIONS`.

4. **Raise or lower threshold.** After a week of global-on, revisit `BASE_QUERY_CACHE_MIN_ROWS`. The 25K default is a conservative guess — the actual crossover where DuckDB starts winning on cold load may be lower. Adjust from metrics.

5. **Phase 2 prep (not this plan).** Design consistent-hash routing using the `base-query-cache:owner:{baseId}` lease key so only one node holds a given collection. This is a separate plan.

Rollback: set `BASE_QUERY_CACHE_ENABLED=false` and restart. No state cleanup required (DuckDB lives in-process; Redis keys auto-expire via the warm-set trim, but can be dropped with `DEL base-query-cache:recent` if desired).

---

## Appendix: open questions flagged for user confirmation

These are guesses embedded in the plan that the executor should confirm before moving past the commits that encode them:

- **`BASE_QUERY_CACHE_MIN_ROWS = 25000`** — threshold for "large." Derived from the observation that the Postgres path stays below 200ms up to ~30K rows. Confirm from real metrics after task 10.
- **`BASE_QUERY_CACHE_MAX_COLLECTIONS = 50`** — memory cap, lowered from an earlier 500 draft to a self-host-safe default. At ~100 MB/collection this implies a ~5 GB RSS ceiling, which fits typical self-host boxes. Larger deployments should raise it explicitly via env. Confirm with user.
- **`BASE_QUERY_CACHE_WARM_TOP_N = 50`** — boot-warm size. Chosen to balance boot time (50 × 10–15s = 8–12 min sequential) vs steady-state cache freshness. Confirm.
- **Trgm search routes to Postgres** — v1 doesn't populate `search_text` in DuckDB. Cheap to add (loader just copies `row.searchText`), but untested against the trigger-maintained `f_unaccent` normalization in Postgres. Leave on Postgres in v1; revisit later.
- **`@duckdb/node-api@^1.5.x`** — official high-level binding, latest as of writing is 1.5.2. Confirm npm registry pin at task 1 time.
- **Redis channel prefix `base-query-cache:`** — consistent with existing `presence:base:` and `typesense:` naming. If there's a house convention for "infra cache" keys, align here before committing task 7.
