# Cycle-Safe Page Hierarchy Reads Implementation Plan

> **For agentic workers:** REQUIRED SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every reachable recursive page-hierarchy read terminate when a page ID repeats on the same traversal path, then fail closed without returning partial hierarchy data or performing partial mutations.

**Architecture:** Each recursive CTE carries a path-local `uuid[]` named `traversalPath` and an `isCycle` marker. The anchor path contains the starting page ID. Each recursive row appends the next page ID, marks the row when that ID already exists in the prior path, and recursion continues only from rows where `isCycle = false`. This emits the first repeated row once, stops that branch immediately, and lets the caller deny access or raise a controlled domain error. Bulk queries retain a separate path per seed page or child; they must not globally deduplicate IDs shared by legitimate paths.

**Tech Stack:** TypeScript, NestJS 11, Kysely 0.28, PostgreSQL 18, Jest 30, pnpm 11.

**Spec:** Agreed design in this conversation (bounded change; no separate spec file).

---

## Decision and scope

This patch covers the 16 reachable recursive page-hierarchy methods:

- `PageService.getPageBreadCrumbs`
- `PageService.forceDelete`
- `TrashCleanupService.cleanupPage`
- `ShareService.getShareForPage`
- `PageRepo.removePage`
- `PageRepo.restorePage`
- `PageRepo.getPageAndDescendants`
- `PageRepo.getPageAndDescendantsExcludingRestricted`
- `PagePermissionRepo.findRestrictedAncestor`
- `PagePermissionRepo.canUserEditPage`
- `PagePermissionRepo.getUserPageAccessLevel`
- `PagePermissionRepo.filterAccessiblePageIds`
- `PagePermissionRepo.filterAccessiblePageIdsWithPermissions`
- `PagePermissionRepo.hasRestrictedAncestor`
- `PagePermissionRepo.getParentIdsWithAccessibleChildren`
- `PagePermissionRepo.getUserIdsWithPageAccess`

The two statically unreferenced methods, which contain three more recursive CTEs, will be deleted rather than hardened:

- `ShareService.getShareAncestorPage`
- `PagePermissionRepo.getRestrictedSubtreeIds`

Explicitly out of scope:

- write-side parent validation in `movePage`
- a database constraint or trigger
- repairing already-corrupt page relationships
- a maximum-depth limit
- statement timeouts as the primary defense
- replacing `UNION ALL` with `UNION`

## Required invariants

Use this shape in every ancestor traversal, translated to Kysely where applicable:

```sql
WITH RECURSIVE ancestors AS (
  SELECT
    p.id,
    p.parent_page_id,
    ARRAY[p.id]::uuid[] AS traversal_path,
    false AS is_cycle
  FROM pages p
  WHERE p.id = $1

  UNION ALL

  SELECT
    p.id,
    p.parent_page_id,
    a.traversal_path || p.id,
    p.id = ANY(a.traversal_path) AS is_cycle
  FROM pages p
  JOIN ancestors a ON a.parent_page_id = p.id
  WHERE NOT a.is_cycle
)
```

Descendant queries use the same rule but join `p.parent_page_id` to the current descendant ID. The repeated row is deliberately emitted once so the outer query can observe `isCycle`; it must never be expanded.

For bulk traversal, retain the seed key alongside the path:

```text
pageId/childId | ancestorId | parentPageId | traversalPath | isCycle
```

The path belongs to that seed and branch. Do not use one global visited set: two requested pages may legitimately share an ancestor.

The internal `traversalPath` and `isCycle` columns must be stripped before returning existing DTOs or entity-shaped results.

## Fail-closed behavior matrix

| Read category | Cycle result |
|---|---|
| Breadcrumbs and structural hierarchy reads | Throw `PageHierarchyCycleError`; return no partial hierarchy |
| Permission checks returning booleans | Deny (`false`) or treat as restricted (`true` for `hasRestrictedAncestor`) |
| Permission filters returning page IDs | Exclude the cyclic seed page |
| Notification recipient lookup | Return no recipients for a cyclic page |
| Public share lookup | Return `undefined`/existing not-found behavior |
| Delete, restore, or force-delete traversal | Throw before the first update, delete, queue write, or event |
| Scheduled trash cleanup | Log the domain error for that root, skip it, and continue with other roots |

---

### Task 1: Add the cycle-domain contract

**Files:**

- Create: `apps/server/src/database/helpers/page-hierarchy-cycle.ts`
- Create: `apps/server/src/database/helpers/page-hierarchy-cycle.spec.ts`

- [ ] **Step 1: Write the failing helper tests**

Cover these cases:

```ts
it('does nothing when no row is marked as a cycle');
it('throws PageHierarchyCycleError when a row is marked as a cycle');
it('keeps the root page id on the error for safe logging');
it('removes traversal metadata without changing the public row fields');
```

- [ ] **Step 2: Run the focused test and confirm it fails because the helper does not exist**

Run:

```bash
pnpm --filter server test -- database/helpers/page-hierarchy-cycle.spec.ts --runInBand
```

Expected: FAIL on the missing module or missing exports.

- [ ] **Step 3: Implement the small shared contract**

Provide:

```ts
export type CycleTrackedRow = {
  traversalPath: string[];
  isCycle: boolean;
};

export class PageHierarchyCycleError extends Error {
  readonly code = 'PAGE_HIERARCHY_CYCLE';

  constructor(readonly rootPageId: string) {
    super('Cyclic page hierarchy detected');
    this.name = 'PageHierarchyCycleError';
  }
}

export function assertAcyclicPageTraversal<T extends CycleTrackedRow>(
  rows: readonly T[],
  rootPageId: string,
): void;

export function stripPageTraversalMetadata<T extends CycleTrackedRow>(
  row: T,
): Omit<T, keyof CycleTrackedRow>;
```

`assertAcyclicPageTraversal` checks only the bounded result already produced by the SQL guard. It is not the termination mechanism.

- [ ] **Step 4: Run the focused tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/database/helpers/page-hierarchy-cycle.ts apps/server/src/database/helpers/page-hierarchy-cycle.spec.ts
git commit -m "fix: add page hierarchy cycle contract"
```

### Task 2: Add a safe PostgreSQL integration-test harness

**Files:**

- Create: `apps/server/test/docker-compose.integration.yml`
- Create: `apps/server/test/jest-integration.json`
- Create: `apps/server/test/support/database.ts`
- Create: `apps/server/test/support/page-hierarchy-fixtures.ts`
- Create: `apps/server/test/page-hierarchy-cycle.integration-spec.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Define a disposable PostgreSQL service**

Use PostgreSQL 18, bind it only to `127.0.0.1:55432`, and use a dedicated `docmost_cycle_test` database. Do not point these tests at the development database.

- [ ] **Step 2: Add a dedicated Jest configuration and script**

Add:

```json
"test:integration": "jest --config test/jest-integration.json --runInBand"
```

Match `*.integration-spec.ts`, preserve the server's existing TypeScript transforms and module aliases, and use `TEST_DATABASE_URL` rather than `DATABASE_URL` inside test support.

- [ ] **Step 3: Build the database helper**

The helper must:

- create a Kysely instance with `PostgresJSDialect` and `CamelCasePlugin`
- expose a connection-bound callback so `SET statement_timeout = '500ms'` and the production query use the same PostgreSQL connection
- close the postgres.js pool in `afterAll`
- truncate fixture tables between cases

Run migrations before the suite with the existing migration CLI:

```bash
docker compose -f apps/server/test/docker-compose.integration.yml up -d
DATABASE_URL=postgresql://docmost:docmost@127.0.0.1:55432/docmost_cycle_test pnpm --filter server migration:latest
```

- [ ] **Step 4: Add fixture builders**

Seed one workspace and space, then expose helpers for:

- an acyclic chain: `root <- child <- grandchild`
- a self-cycle: `self.parentPageId = self.id`
- a two-page cycle: `a.parentPageId = b.id`, `b.parentPageId = a.id`
- a branching descendant tree

Corruption is inserted directly with SQL so the test remains valid after a later write-side fix.

- [ ] **Step 5: Add an acyclic harness smoke test**

Verify a fixture can be inserted and read through the test Kysely instance. Do not run an unguarded recursive query in this task.

- [ ] **Step 6: Run the integration smoke test**

Run:

```bash
TEST_DATABASE_URL=postgresql://docmost:docmost@127.0.0.1:55432/docmost_cycle_test pnpm --filter server test:integration -- page-hierarchy-cycle.integration-spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/test apps/server/package.json
git commit -m "test: add page hierarchy cycle integration harness"
```

### Task 3: Harden breadcrumbs and inherited-share lookup

**Files:**

- Modify: `apps/server/src/core/page/services/page.service.ts`
- Modify: `apps/server/src/core/share/share.service.ts`
- Modify: `apps/server/test/page-hierarchy-cycle.integration-spec.ts`

- [ ] **Step 1: Add failing, statement-time-limited tests**

Add tests that prove:

- `getPageBreadCrumbs(grandchild)` returns each acyclic ancestor exactly once in root-to-child order
- breadcrumb traversal of a self-cycle raises `PageHierarchyCycleError`
- breadcrumb traversal of a two-page cycle raises `PageHierarchyCycleError`
- `getShareForPage` still returns the nearest valid inherited share
- a cyclic share chain with no reachable share returns `undefined`

Run each cyclic case on a connection with `statement_timeout = '500ms'`. Before the fix, the expected domain result is not produced; PostgreSQL cancels the query instead of allowing an unbounded test to consume memory.

- [ ] **Step 2: Run the focused integration tests and confirm failure**

Expected: cyclic cases FAIL with query cancellation or a mismatched result.

- [ ] **Step 3: Add visited-ID state to `getPageBreadCrumbs`**

In the Kysely recursive CTE:

- anchor with `ARRAY[pages.id]::uuid[] AS traversalPath` and `false AS isCycle`
- recursive row with `pa.traversal_path || p.id AS traversalPath`
- mark `p.id = ANY(pa.traversal_path) AS isCycle`
- add `.where('pa.isCycle', '=', false)` to the recursive member
- execute the bounded query
- call `assertAcyclicPageTraversal(ancestors, childPageId)` before reversing
- strip `traversalPath` and `isCycle`, then return the existing breadcrumb shape

- [ ] **Step 4: Replace the share depth guard with visited IDs**

In `ShareService.getShareForPage`:

- remove `level < 25`; retain `level` only for nearest-share semantics
- carry `traversalPath` and `isCycle`
- recurse only while `shareId IS NULL AND isCycle = false`
- fetch the bounded traversal rows instead of filtering cycle rows away with `WHERE shareId IS NOT NULL LIMIT 1`
- if any row has `isCycle = true`, return `undefined`
- otherwise choose the first row with a share and preserve workspace and `includeSubPages` checks
- strip internal traversal fields from the returned object

A direct share may stop traversal before encountering corrupt parents; that is valid because the query has already terminated and does not need the parent chain.

- [ ] **Step 5: Run focused tests, unit tests, and build**

```bash
TEST_DATABASE_URL=postgresql://docmost:docmost@127.0.0.1:55432/docmost_cycle_test pnpm --filter server test:integration -- page-hierarchy-cycle.integration-spec.ts
pnpm --filter server test -- database/helpers/page-hierarchy-cycle.spec.ts --runInBand
pnpm --filter server build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/core/page/services/page.service.ts apps/server/src/core/share/share.service.ts apps/server/test/page-hierarchy-cycle.integration-spec.ts
git commit -m "fix: stop cyclic breadcrumb and share traversal"
```

### Task 4: Harden single-page permission traversal

**Files:**

- Modify: `apps/server/src/database/repos/page/page-permission.repo.ts`
- Modify: `apps/server/test/page-hierarchy-cycle.integration-spec.ts`

Methods in this task:

- `findRestrictedAncestor`
- `canUserEditPage`
- `getUserPageAccessLevel`
- `hasRestrictedAncestor`
- `getUserIdsWithPageAccess`

- [ ] **Step 1: Add failing permission tests**

For both a self-cycle and a two-page cycle, assert:

```text
canUserEditPage                 => hasAnyRestriction=true, canAccess=false, canEdit=false
getUserPageAccessLevel          => hasAnyRestriction=true, canAccess=false, canEdit=false
hasRestrictedAncestor           => true
getUserIdsWithPageAccess        => []
findRestrictedAncestor          => throws PageHierarchyCycleError
```

Also retain acyclic cases with no restriction, a permitted restriction, and a denied restriction so the cycle guard cannot silently change normal authorization semantics.

- [ ] **Step 2: Run the permission group and confirm cyclic cases fail safely under the statement timeout**

- [ ] **Step 3: Add the path and marker to each CTE**

For raw SQL methods use snake_case aliases:

```sql
ARRAY[id]::uuid[] AS traversal_path,
false AS is_cycle
```

and:

```sql
a.traversal_path || p.id,
p.id = ANY(a.traversal_path) AS is_cycle
...
WHERE NOT a.is_cycle
```

For Kysely methods use `traversalPath` and `isCycle`; `CamelCasePlugin` maps their SQL names.

- [ ] **Step 4: Make each result fail closed without hiding the marker**

- `findRestrictedAncestor`: retrieve the bounded ancestor rows with a left join, assert acyclic before selecting the nearest restricted row, and return the same public shape.
- `canUserEditPage`: aggregate `bool_or(a.is_cycle)` as an internal flag; on a cycle return the denial tuple and allow the existing cache to cache only that safe result.
- `getUserPageAccessLevel`: select an internal `hasHierarchyCycle`; when true return the denial tuple and count the safety denial in `hasAnyRestriction`.
- `hasRestrictedAncestor`: return `true` if either a `page_access` row exists or the CTE reports a cycle.
- `getUserIdsWithPageAccess`: require `NOT EXISTS (SELECT 1 FROM ancestors WHERE is_cycle)` before evaluating candidates.

Do not throw from boolean/filter permission methods: callers often translate denial into existing 404/forbidden behavior. Do not return the first matching permission row before cycle state has been evaluated.

- [ ] **Step 5: Run focused integration tests and build**

```bash
TEST_DATABASE_URL=postgresql://docmost:docmost@127.0.0.1:55432/docmost_cycle_test pnpm --filter server test:integration -- page-hierarchy-cycle.integration-spec.ts -t "single-page permissions"
pnpm --filter server build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/database/repos/page/page-permission.repo.ts apps/server/test/page-hierarchy-cycle.integration-spec.ts
git commit -m "fix: fail closed on cyclic permission ancestry"
```

### Task 5: Harden bulk permission traversal with path-local visited IDs

**Files:**

- Modify: `apps/server/src/database/repos/page/page-permission.repo.ts`
- Modify: `apps/server/test/page-hierarchy-cycle.integration-spec.ts`

Methods in this task:

- `filterAccessiblePageIds`
- `filterAccessiblePageIdsWithPermissions`
- `getParentIdsWithAccessibleChildren`

- [ ] **Step 1: Add failing mixed-batch tests**

Submit an acyclic page and a cyclic page in the same request. Assert:

- both filter methods preserve the accessible acyclic page
- both filter methods exclude the cyclic seed
- `getParentIdsWithAccessibleChildren` does not treat a cyclic child as accessible
- a legitimate shared ancestor used by two different acyclic seeds is not mistaken for a cycle

The last case protects against an incorrect global visited set.

- [ ] **Step 2: Run and confirm cyclic cases fail safely under the statement timeout**

- [ ] **Step 3: Carry one traversal path per seed**

For `allAncestors`, keep `pageId` as the seed key and add path/marker columns. For `childAncestors`, keep `childId` as the seed key. In every recursive member:

- append the candidate ancestor ID to that row's `traversalPath`
- compare the candidate only to that same path
- add `WHERE current_cte.is_cycle = false`

- [ ] **Step 4: Exclude only the affected seed**

Add a correlated anti-existence condition equivalent to:

```sql
NOT EXISTS (
  SELECT 1
  FROM all_ancestors aa_cycle
  WHERE aa_cycle.page_id = pages.id
    AND aa_cycle.is_cycle
)
```

Apply the same `childId` correlation in `getParentIdsWithAccessibleChildren`. Keep the existing permission predicates unchanged after the cycle predicate.

- [ ] **Step 5: Run the focused tests and build**

```bash
TEST_DATABASE_URL=postgresql://docmost:docmost@127.0.0.1:55432/docmost_cycle_test pnpm --filter server test:integration -- page-hierarchy-cycle.integration-spec.ts -t "bulk permissions"
pnpm --filter server build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/database/repos/page/page-permission.repo.ts apps/server/test/page-hierarchy-cycle.integration-spec.ts
git commit -m "fix: isolate cycles in bulk permission traversal"
```

### Task 6: Harden descendant reads before any side effect

**Files:**

- Modify: `apps/server/src/database/repos/page/page.repo.ts`
- Modify: `apps/server/src/core/page/services/page.service.ts`
- Modify: `apps/server/src/core/page/services/trash-cleanup.service.ts`
- Modify: `apps/server/test/page-hierarchy-cycle.integration-spec.ts`

Methods in this task:

- `PageRepo.removePage`
- `PageRepo.restorePage`
- `PageRepo.getPageAndDescendants`
- `PageRepo.getPageAndDescendantsExcludingRestricted`
- `PageService.forceDelete`
- `TrashCleanupService.cleanupPage`

- [ ] **Step 1: Add failing descendant tests**

Assert:

- an acyclic branching tree returns every page exactly once
- a self-cycle and a two-page cycle raise `PageHierarchyCycleError` in structural reads
- `removePage` performs no page update, share delete, or event emission on a cycle
- `restorePage` performs no restore update or event emission on a cycle
- `forceDelete` enqueues no attachment job and deletes nothing on a cycle
- trash cleanup logs/skips the corrupt root and continues to the next eligible acyclic root
- restricted-subtree behavior remains unchanged for an acyclic tree

- [ ] **Step 2: Run and confirm cyclic cases fail safely under the statement timeout**

- [ ] **Step 3: Add branch-local paths to descendant CTEs**

Each anchor starts with its own ID. For each candidate child `p`:

```sql
current.traversal_path || p.id AS traversal_path,
p.id = ANY(current.traversal_path) AS is_cycle
```

and recursion is allowed only from `current.is_cycle = false`.

- [ ] **Step 4: Detect before mutation or output**

- Materialize the bounded traversal.
- Call `assertAcyclicPageTraversal` before deriving `pageIds`, queuing jobs, updating rows, deleting shares, or emitting events.
- Strip traversal metadata from `getPageAndDescendants` results.
- In `getPageAndDescendantsExcludingRestricted`, do not filter the cycle row out before inspection. Fetch the bounded rows with `isRestricted` and cycle metadata, assert, then filter restricted rows and strip internal fields in memory.
- Let the existing per-page `try/catch` in trash cleanup log `PageHierarchyCycleError` and continue.

- [ ] **Step 5: Run focused integration tests and build**

```bash
TEST_DATABASE_URL=postgresql://docmost:docmost@127.0.0.1:55432/docmost_cycle_test pnpm --filter server test:integration -- page-hierarchy-cycle.integration-spec.ts -t "descendant traversal"
pnpm --filter server build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/database/repos/page/page.repo.ts apps/server/src/core/page/services/page.service.ts apps/server/src/core/page/services/trash-cleanup.service.ts apps/server/test/page-hierarchy-cycle.integration-spec.ts
git commit -m "fix: stop cyclic descendant traversal before side effects"
```

### Task 7: Remove unreachable recursive readers

**Files:**

- Modify: `apps/server/src/core/share/share.service.ts`
- Modify: `apps/server/src/database/repos/page/page-permission.repo.ts`

- [ ] **Step 1: Reconfirm the methods are unreferenced**

Run:

```bash
rg -n "getShareAncestorPage|getRestrictedSubtreeIds" apps/server/src apps/server/test
```

Expected: only the two declarations are present.

- [ ] **Step 2: Delete both methods**

Remove `ShareService.getShareAncestorPage` and `PagePermissionRepo.getRestrictedSubtreeIds`, including all three dormant recursive CTEs. Do not keep dead unsafe implementations for possible future use.

- [ ] **Step 3: Build and run related tests**

```bash
pnpm --filter server build
pnpm --filter server test -- --runInBand
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/core/share/share.service.ts apps/server/src/database/repos/page/page-permission.repo.ts
git commit -m "refactor: remove unused hierarchy readers"
```

### Task 8: Audit every recursive reader and reproduce the HTTP PoC safely

**Files:**

- Modify: `apps/server/test/page-hierarchy-cycle.integration-spec.ts`
- Modify if needed: `apps/server/src/core/page/services/page.service.spec.ts`

- [ ] **Step 1: Perform a static recursive-CTE audit**

Run:

```bash
rg -n "withRecursive\(|WITH RECURSIVE" apps/server/src/core/page apps/server/src/core/share apps/server/src/database/repos/page
rg -n "traversalPath|traversal_path|isCycle|is_cycle" apps/server/src/core/page apps/server/src/core/share apps/server/src/database/repos/page
```

Expected:

- 16 reachable recursive hierarchy methods remain.
- Every one carries a visited-ID path and a cycle marker.
- Every recursive member refuses to expand a row already marked as a cycle.
- No `level < 25` or replacement depth cap exists.

- [ ] **Step 2: Add the cold-cache permission regression**

For a self-cycle, call `canUserEditPage` with an empty cache and assert a bounded fail-closed denial. This covers the path that can execute before breadcrumbs.

- [ ] **Step 3: Reproduce the warm-cache breadcrumb sequence**

Using a valid authenticated test fixture or a local Docker deployment:

1. Create page A in a valid hierarchy.
2. Request breadcrumbs once to warm the page-permission cache.
3. Corrupt A directly so `parent_page_id = id`.
4. Send `POST /api/pages/breadcrumbs` for A.
5. Assert the request terminates with a non-success response and no partial breadcrumb payload.
6. Immediately request the health endpoint and assert the same Node.js process remains healthy.

Put a client-side request deadline around the check; the server-side correctness must come from visited-ID detection, not the client deadline.

- [ ] **Step 4: Repeat with a two-page cycle**

Use `A.parent_page_id = B.id` and `B.parent_page_id = A.id`, then repeat the breadcrumb and health assertions.

- [ ] **Step 5: Run the complete verification suite**

```bash
pnpm --filter server test -- --runInBand
TEST_DATABASE_URL=postgresql://docmost:docmost@127.0.0.1:55432/docmost_cycle_test pnpm --filter server test:integration
pnpm --filter server build
```

Expected: all commands PASS; neither cyclic fixture reaches PostgreSQL's 500 ms statement timeout.

- [ ] **Step 6: Inspect the final diff for scope and API leakage**

Run:

```bash
git diff --check
git diff --stat
git diff
```

Confirm:

- no write-path validation was added
- no depth cap was added
- no response includes `traversalPath`, `traversal_path`, `isCycle`, or `is_cycle`
- permission methods deny only cyclic seeds, not unrelated batch entries
- mutation methods inspect cycle state before side effects

- [ ] **Step 7: Stop and remove the disposable integration database**

```bash
docker compose -f apps/server/test/docker-compose.integration.yml down -v
```

- [ ] **Step 8: Commit final regression coverage**

```bash
git add apps/server/test/page-hierarchy-cycle.integration-spec.ts apps/server/src/core/page/services/page.service.spec.ts
git commit -m "test: cover cyclic page hierarchy denial of service"
```

## Acceptance criteria

- A repeated page UUID on one ancestor or descendant path is emitted once, marked, and never expanded.
- Self-cycles and multi-page cycles terminate without relying on a maximum depth.
- `POST /api/pages/breadcrumbs` cannot exhaust Node.js heap on either a cold or warm permission cache.
- All 16 reachable recursive hierarchy methods are guarded.
- The three CTEs in the two unreachable methods are removed.
- Permission reads fail closed and bulk reads isolate denial to the affected seed.
- Structural mutations make no partial changes when a cycle is detected.
- Existing acyclic hierarchy, restriction, share inheritance, ordering, and response shapes remain unchanged.
