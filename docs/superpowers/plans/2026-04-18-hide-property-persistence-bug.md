# Hide-Property Persistence Bug Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop hidden column toggles from silently reappearing when another view-config mutation or a websocket-driven refetch lands between the toggle and the 300 ms debounced persist.

**Architecture:** Two narrow fixes in the client — nothing server-side. (1) The blind `setColumnVisibility(derivedColumnVisibility)` sync effect in [`use-base-table.ts`](apps/client/src/features/base/hooks/use-base-table.ts) is scoped to run only when the user switches views, so refetches of the same view can't overwrite pending local toggles. (2) The sort/filter mutations in [`base-toolbar.tsx`](apps/client/src/features/base/components/base-toolbar.tsx) merge in the live table state (visibility / order / widths) instead of spreading stale `activeView.config` — so saving a sort no longer clobbers a not-yet-persisted hide.

**Tech Stack:** React 18, TanStack Table v8, TanStack Query v5, Mantine, TypeScript.

---

## Background — why this happens

`useBaseTable` keeps `columnVisibility` as local React state, seeded from the persisted view config via a `useMemo`-derived value (`derivedColumnVisibility`). Two effects currently do an unconditional re-sync:

```ts
// apps/client/src/features/base/hooks/use-base-table.ts:223-229
useEffect(() => {
  setColumnOrder(derivedColumnOrder);
}, [derivedColumnOrder]);

useEffect(() => {
  setColumnVisibility(derivedColumnVisibility);
}, [derivedColumnVisibility]);
```

Any mutation that calls `queryClient.setQueryData(["bases", baseId], ...)` — or `queryClient.invalidateQueries` at [`use-base-socket.ts:254`](apps/client/src/features/base/hooks/use-base-socket.ts:254) on ws `base:property:*` / `base:view:*` events — minted a new `activeView.config` reference. That recomputes `derivedColumnVisibility`, and the effect slams the local state back to whatever the server currently has.

Persistence is debounced 300 ms by `persistViewConfig`. During that window, any of these triggers a stomp:

1. **A concurrent sort / filter mutation from the same user.** `handleSortsChange` / `handleFiltersChange` in [`base-toolbar.tsx:93-120`](apps/client/src/features/base/components/base-toolbar.tsx:93) spread `activeView.config` (stale — still has old `hiddenPropertyIds`) and `mutate` immediately, without going through the debounced path. The `onMutate` optimistic write, the `onSuccess` server write, and the ws echo's `invalidateQueries` each re-trigger the effect.
2. **Another client sending any `base:property:*` / `base:view:*` ws event.**
3. **The optimistic / success writes from our OWN `persistViewConfig` mutation when the server-side state hasn't persisted yet** (e.g., response races).

Symptom: user toggles a column hidden → column disappears → column reappears within ~instant to a few hundred ms → reload confirms the toggle was never saved.

**Deterministic repro (no second client needed):**
1. Open a base with ≥ 3 non-primary columns and no sorts.
2. In the toolbar, open "Hide fields" and toggle column X off. Column vanishes.
3. Immediately (well under 300 ms) open the Sort popover and add a sort.
4. Column X reappears.
5. Reload: X is visible; sort is saved; hide was lost.

`hiddenPropertyIds` wins semantics check: [`use-base-table.ts:117-143`](apps/client/src/features/base/hooks/use-base-table.ts:117) — correct (hidden list is checked first, then legacy `visiblePropertyIds`, then default all-visible). That isn't the bug.

---

## File Structure

**Modified files:**
- `apps/client/src/features/base/hooks/use-base-table.ts` — gate the re-sync effect behind a view-id ref; export a new `buildViewConfigFromTable` helper used by both the debounced persist and the toolbar's direct mutations.
- `apps/client/src/features/base/components/base-toolbar.tsx` — `handleSortsChange` / `handleFiltersChange` build the full config from live table state (not `activeView.config`) before `mutate`.

No new files. No server-side changes. No new deps.

---

## Task 1: Verify the repro against the current build

- [ ] **Step 1: Build the client** to make sure the branch is clean before changing anything.

```bash
pnpm nx run client:build
```

Expected: build succeeds.

- [ ] **Step 2: Ask the user to run the deterministic repro above.**

(Per `CLAUDE.md` the agent must not run `pnpm dev`.) User should confirm:
- Column X disappears, then reappears within ~300 ms of adding the sort.
- Reload shows X visible, hide lost.

If the repro does NOT reproduce for the user, stop the plan here and ask for actual repro steps — the fixes below target this specific chain.

---

## Task 2: Extract `buildViewConfigFromTable` helper

**Files:**
- Modify: `apps/client/src/features/base/hooks/use-base-table.ts`

- [ ] **Step 1: Add the helper near the other build functions** (above `useBaseTable`, after `buildColumnPinning`)

```ts
// Serializes the live react-table state into a persisted ViewConfig.
// Sort/filter toolbar mutations and the debounced `persistViewConfig`
// both go through this so a direct mutation (e.g. adding a sort) can't
// clobber a pending hide/reorder/resize by reading stale `activeView.config`.
export function buildViewConfigFromTable(
  table: Table<IBaseRow>,
  base: ViewConfig | undefined,
  overrides: Partial<ViewConfig> = {},
): ViewConfig {
  const state = table.getState();

  const sorts = state.sorting.map((s) => ({
    propertyId: s.id,
    direction: (s.desc ? "desc" : "asc") as "asc" | "desc",
  }));

  const propertyWidths: Record<string, number> = {};
  Object.entries(state.columnSizing).forEach(([id, width]) => {
    if (id !== "__row_number") propertyWidths[id] = width;
  });

  const propertyOrder = state.columnOrder.filter((id) => id !== "__row_number");

  const hiddenPropertyIds = Object.entries(state.columnVisibility)
    .filter(([id, visible]) => id !== "__row_number" && !visible)
    .map(([id]) => id);

  return {
    ...base,
    sorts,
    propertyWidths,
    propertyOrder,
    hiddenPropertyIds,
    visiblePropertyIds: undefined,
    ...overrides,
  };
}
```

- [ ] **Step 2: Replace the inline serialization inside `persistViewConfig`** (lines roughly 267-297 of the current file) with a call to the helper.

Before:
```ts
persistTimerRef.current = setTimeout(() => {
  const state = table.getState();
  const sorts = state.sorting.map((s) => ({ ... }));
  // ...lots of inline serialization...
  const config: ViewConfig = {
    ...activeView.config,
    sorts,
    propertyWidths,
    propertyOrder,
    hiddenPropertyIds,
    visiblePropertyIds: undefined,
  };
  updateViewMutation.mutate({ viewId: activeView.id, baseId: base.id, config });
}, 300);
```

After:
```ts
persistTimerRef.current = setTimeout(() => {
  const config = buildViewConfigFromTable(table, activeView.config);
  updateViewMutation.mutate({ viewId: activeView.id, baseId: base.id, config });
}, 300);
```

- [ ] **Step 3: Build**

```bash
pnpm nx run client:build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/features/base/hooks/use-base-table.ts
git commit -m "refactor(base): extract buildViewConfigFromTable helper"
```

---

## Task 3: Route sort/filter mutations through the helper

**Files:**
- Modify: `apps/client/src/features/base/components/base-toolbar.tsx`

`handleSortsChange` and `handleFiltersChange` currently read `activeView.config` directly, which reflects the server-persisted state, not the user's pending local changes. They must build the new config from `table.getState()` + the new sort or filter.

- [ ] **Step 1: Import the helper and accept the full view config for merging filters**

Add at the top of the file:
```ts
import { buildViewConfigFromTable } from "@/features/base/hooks/use-base-table";
```

- [ ] **Step 2: Rewrite `handleSortsChange`**

Before:
```ts
const handleSortsChange = useCallback(
  (newSorts: ViewSortConfig[]) => {
    if (!activeView) return;
    updateViewMutation.mutate({
      viewId: activeView.id,
      baseId: base.id,
      config: { ...activeView.config, sorts: newSorts },
    });
  },
  [activeView, base.id, updateViewMutation],
);
```

After:
```ts
const handleSortsChange = useCallback(
  (newSorts: ViewSortConfig[]) => {
    if (!activeView) return;
    const config = buildViewConfigFromTable(table, activeView.config, {
      sorts: newSorts,
    });
    updateViewMutation.mutate({
      viewId: activeView.id,
      baseId: base.id,
      config,
    });
  },
  [activeView, base.id, table, updateViewMutation],
);
```

- [ ] **Step 3: Rewrite `handleFiltersChange` the same way**

Before:
```ts
const handleFiltersChange = useCallback(
  (newConditions: FilterCondition[]) => {
    if (!activeView) return;
    const filter: FilterGroup | undefined =
      newConditions.length > 0
        ? { op: "and", children: newConditions }
        : undefined;
    const { filter: _drop, ...rest } = activeView.config ?? {};
    updateViewMutation.mutate({
      viewId: activeView.id,
      baseId: base.id,
      config: filter ? { ...rest, filter } : rest,
    });
  },
  [activeView, base.id, updateViewMutation],
);
```

After:
```ts
const handleFiltersChange = useCallback(
  (newConditions: FilterCondition[]) => {
    if (!activeView) return;
    const filter: FilterGroup | undefined =
      newConditions.length > 0
        ? { op: "and", children: newConditions }
        : undefined;
    // `filter: undefined` in overrides removes the filter key; the helper's
    // spread-then-overrides order means `undefined` wins over any base filter.
    const config = buildViewConfigFromTable(table, activeView.config, {
      filter,
    });
    updateViewMutation.mutate({
      viewId: activeView.id,
      baseId: base.id,
      config,
    });
  },
  [activeView, base.id, table, updateViewMutation],
);
```

- [ ] **Step 4: Build**

```bash
pnpm nx run client:build
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/features/base/components/base-toolbar.tsx
git commit -m "fix(base): merge live table state into sort and filter mutations"
```

---

## Task 4: Gate the sync effect behind view-id change

**Files:**
- Modify: `apps/client/src/features/base/hooks/use-base-table.ts`

Within the same view, local state is the source of truth and the debounced persist flushes it. The sync effect must only run when the user switches to a different view (where the server's config is authoritative).

- [ ] **Step 1: Replace both sync effects**

Before (around lines 220-229):
```ts
const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(derivedColumnOrder);
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(derivedColumnVisibility);

useEffect(() => {
  setColumnOrder(derivedColumnOrder);
}, [derivedColumnOrder]);

useEffect(() => {
  setColumnVisibility(derivedColumnVisibility);
}, [derivedColumnVisibility]);
```

After:
```ts
const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(derivedColumnOrder);
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(derivedColumnVisibility);

// Re-seed from server only when the user switches views. Within the same
// view, local state is the source of truth — the debounced persist flushes
// it. Without this guard, any ws-driven `invalidateQueries(["bases", baseId])`
// or concurrent view mutation lands a new `derivedColumnVisibility`
// reference and the effect would overwrite a pending hide/reorder toggle
// before `persistViewConfig` has a chance to flush it.
const lastSyncedViewIdRef = useRef<string | undefined>(activeView?.id);
useEffect(() => {
  const currentViewId = activeView?.id;
  if (currentViewId !== lastSyncedViewIdRef.current) {
    lastSyncedViewIdRef.current = currentViewId;
    setColumnOrder(derivedColumnOrder);
    setColumnVisibility(derivedColumnVisibility);
  }
}, [activeView?.id, derivedColumnOrder, derivedColumnVisibility]);
```

Note: `derivedColumnOrder` and `derivedColumnVisibility` remain in the dependency array so the effect reads the current derived values when a view switch happens. The ref-guarded branch only fires on id change.

- [ ] **Step 2: Build**

```bash
pnpm nx run client:build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/base/hooks/use-base-table.ts
git commit -m "fix(base): only re-seed column state when view identity changes"
```

---

## Task 5: USER manual verification — scripted steps

> ⚠️ **Do not run `pnpm dev` as an agent.** Hand off to the user with the cases below.

Ask the user to run through these. Each should now behave correctly:

- [ ] **Repro from Task 1 — hide then add sort**
  1. Open a base with ≥ 3 non-primary columns.
  2. Hide column X via the popover.
  3. Within 300 ms, add a sort via the Sort popover.
  4. Expected: column X stays hidden. Sort indicator shows. Reload: both persisted.

- [ ] **Hide then change filter**
  1. Hide column Y.
  2. Immediately add a filter condition.
  3. Expected: column Y stays hidden, filter applied. Reload: both persisted.

- [ ] **Hide all / show all**
  1. Click "Hide all" in the popover. All non-primary columns disappear.
  2. Reload. Expected: same state.
  3. Click "Show all". Reload. Expected: all columns visible.

- [ ] **View switch**
  1. Hide column Z on view A.
  2. Switch to view B (no hide). Expected: Z visible in view B.
  3. Switch back to view A. Expected: Z hidden.

- [ ] **WebSocket reconcile doesn't stomp**
  1. Hide column W.
  2. From another browser / incognito session on the same base, add a new property.
  3. In the first window, the new property appears visible, W stays hidden.

- [ ] **Primary property can't be hidden** (regression check)
  1. Open the popover — the primary column's switch is disabled (already enforced by `enableHiding: !property.isPrimary` at `use-base-table.ts:87`). Confirm.

---

## Task 6: Final commit check + handoff

- [ ] **Step 1: Confirm branch state**

```bash
git status
git log --oneline main..HEAD
```

Expected: clean tree, 3 new commits atop the CSV-export branch (refactor, fix sort/filter merge, fix sync effect).

- [ ] **Step 2: Trigger `superpowers:finishing-a-development-branch`** to choose merge/PR.

---

## Out of scope (explicitly not fixing here)

- **`hiddenFieldCount` badge dep** in `base-toolbar.tsx:88-91` — works by accident today (re-renders produce fresh `getState()` references). Low-impact cosmetic risk; leave alone unless it manifests.
- **Legacy `visiblePropertyIds` migration.** Views created before `hiddenPropertyIds` existed may show new properties as hidden by default in `buildColumnVisibility`. No reports of this; migration would be a separate plan.
- **Batching `handleHideAll`/`handleShowAll`** into a single `table.setColumnVisibility(map)` call instead of iterating `toggleVisibility`. React 18 batches these anyway; not a bug.
- **Server-side zod schema.** `viewConfigSchema` already accepts `hiddenPropertyIds: []` correctly; no change needed.
