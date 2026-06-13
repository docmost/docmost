# New Property Not In View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user creates a new property, it lands in the grid's local column state immediately (appended to the end, visible by default) so the grid can size and scroll to reveal it.

**Architecture:** Single-file fix in [`apps/client/src/features/base/hooks/use-base-table.ts`](apps/client/src/features/base/hooks/use-base-table.ts). Extend the existing gated re-seed effect so that on property add / remove (within the same view) it reconciles local `columnOrder` and `columnVisibility` instead of ignoring the change. Existing per-column user toggles (hide, reorder) are preserved; new columns are appended; deleted columns are dropped.

**Tech Stack:** React 18, TanStack Table v8, TanStack Query v5.

---

## Background

Earlier in this branch (commit `c6f993b6`) the sync effect that copied `derivedColumnOrder` / `derivedColumnVisibility` into local state was gated behind a view-id ref to stop ws-driven base refetches from stomping the user's pending hide-column toggles. Current code:

```ts
// apps/client/src/features/base/hooks/use-base-table.ts:267-281
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

**What goes wrong with a new property in the same view:**

1. User opens `CreatePropertyPopover`, submits → `useCreatePropertyMutation.onSuccess` appends the new property to `["bases", baseId].properties`.
2. `base.properties` has a new reference → `properties` useMemo re-runs → new array reference.
3. `derivedColumnOrder` recomputes — includes the new property id.
4. The gated effect sees `currentViewId === lastSyncedViewIdRef.current`, so it **does nothing**. Local `columnOrder` state still lists the OLD column ids.
5. `columns` prop to `useReactTable` is rebuilt (it memos on `[properties]`), so react-table does know the new column def exists.
6. But state passed via `state={{columnOrder}}` still references only the old columns → `table.getState().columnOrder` → stale → `gridTemplateColumns` (which depends on `table.getVisibleLeafColumns()` + `table.getState().columnOrder` in [`grid-container.tsx:149`](apps/client/src/features/base/components/grid/grid-container.tsx:149)) doesn't get a track for the new column.
7. Result: the new column renders in the DOM (react-table still yields it as visible), but the grid wrapper's `scrollWidth` doesn't extend to contain it, so `handlePropertyCreated`'s [`scrollRef.current.scrollTo({left: scrollWidth})`](apps/client/src/features/base/components/grid/grid-container.tsx:183-192) ends at the OLD scrollWidth — the new column stays clipped at the edge.

The same mechanism also breaks property **deletion** within the same view (local state keeps a dead id) — not the filed symptom, but worth fixing in the same patch.

The same mechanism does NOT break **rename**, because rename changes `property.name` but not property IDs; order + visibility maps key on id, so they stay correct. Rename is already working after the earlier memo-prop-threading fix.

---

## File Structure

**Modified files:**
- `apps/client/src/features/base/hooks/use-base-table.ts` — extend the sync effect.

No new files, no new deps, nothing server-side.

---

## Task 1: Reconcile local column state on property add / remove

**Files:**
- Modify: `apps/client/src/features/base/hooks/use-base-table.ts:260-281`

- [ ] **Step 1: Replace the effect**

Before (current):
```ts
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

After:
```ts
const lastSyncedViewIdRef = useRef<string | undefined>(activeView?.id);
useEffect(() => {
  const currentViewId = activeView?.id;

  // View switch → full re-seed from the server's stored config.
  if (currentViewId !== lastSyncedViewIdRef.current) {
    lastSyncedViewIdRef.current = currentViewId;
    setColumnOrder(derivedColumnOrder);
    setColumnVisibility(derivedColumnVisibility);
    return;
  }

  // Same view — preserve user toggles, but reconcile the id set:
  // append properties that were just created, drop properties that
  // were deleted. Without this, creating a new column leaves it
  // invisible to `table.getState().columnOrder` / `gridTemplateColumns`,
  // and the grid's scrollWidth never grows to include it.
  const validIds = new Set<string>(["__row_number"]);
  for (const p of properties) validIds.add(p.id);

  setColumnOrder((prev) => {
    const prevSet = new Set(prev);
    const kept = prev.filter((id) => validIds.has(id));
    const appended = derivedColumnOrder.filter(
      (id) => !prevSet.has(id) && validIds.has(id),
    );
    if (appended.length === 0 && kept.length === prev.length) return prev;
    return [...kept, ...appended];
  });

  setColumnVisibility((prev) => {
    let changed = false;
    const next: VisibilityState = {};
    for (const [id, visible] of Object.entries(prev)) {
      if (validIds.has(id)) {
        next[id] = visible;
      } else {
        changed = true;
      }
    }
    for (const id of derivedColumnOrder) {
      if (!(id in next)) {
        next[id] = derivedColumnVisibility[id] ?? true;
        changed = true;
      }
    }
    return changed ? next : prev;
  });
}, [
  activeView?.id,
  derivedColumnOrder,
  derivedColumnVisibility,
  properties,
]);
```

Notes for the implementer:
- `VisibilityState` is already imported from `@tanstack/react-table` — no new import needed.
- `properties` is already declared as a memoized value at the top of this hook, so adding it to the dep list is safe.
- The two `setX((prev) => ...)` updaters both short-circuit (return `prev`) when nothing actually changed, which matters because `derivedColumnOrder` / `derivedColumnVisibility` have a new identity every time `properties` does — without the short-circuit the set would fire every render in the same view and blow away user toggles.
- `kept.length === prev.length` is a proxy for "no deletions" and is safe because `prev` can't contain duplicates (react-table enforces id uniqueness, and our own `derivedColumnOrder` is also unique).

- [ ] **Step 2: Build**

```bash
pnpm nx run client:build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/base/hooks/use-base-table.ts
git commit -m "fix(base): include new properties in local column state so the grid can scroll to them"
```

---

## Task 2: USER smoke test

> ⚠️ **Do not run `pnpm dev` as an agent.** Hand off to the user.

After a hard reload:

- [ ] **Create a new property — grid sizes for it and scroll reaches it.**
  1. Open a base with enough columns that horizontal scrolling is already active.
  2. Click the "+" / create-property button, pick a type, submit.
  3. The grid should scroll right automatically; the new column is fully visible; the horizontal scrollbar extends.

- [ ] **New property is visible in the Hide fields popover.**
  1. Open the eye icon (Hide fields).
  2. The new property appears in the list, toggle ON.

- [ ] **Existing toggles are preserved.**
  1. Hide column X.
  2. Create a new column Y. Column X stays hidden; Y appears at the end, visible.

- [ ] **Delete a property.**
  1. From a property's menu, click Delete.
  2. Column disappears from the grid; grid scrollWidth contracts. No stale column left.

- [ ] **View switch still works cleanly.**
  1. Switch to a different view; then switch back.
  2. Hidden / reordered state for that view loads correctly.

- [ ] **Rename still works (regression check).**
  1. Rename a property; the header text updates without reload.

- [ ] **Hide + concurrent sort mutation (regression for the original hide bug).**
  1. Hide a column, then add a sort within 300 ms. Column stays hidden; sort applies.

If any step fails, report back with the specific case.

---

## Out of scope

- Scrolling behavior on row add (orthogonal, not broken).
- The two `rAF` delay in `handlePropertyCreated` — it already waits long enough once state reconciliation happens in the same render cycle.
- `columnSizing` reconciliation — a new column uses its defined size automatically via react-table's `initialState`, and a deleted column's entry in the sizing state is harmless.
