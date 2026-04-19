# Hide Property Still Broken — Diagnose & Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify and fix the reason that toggling a property in the hide-fields popover no longer ends up in the POST payload sent to `/bases/views/update`.

**Architecture:** Instrument the toggle → state → debounced persist pipeline, have the user reproduce, read the logs, fix the exact bug. Do NOT blindly apply a "defensive" fix before the bug is pinpointed — we've burned several "fixes" on this already and need ground truth first.

**Tech Stack:** React 18, TanStack Table v8 (controlled `state.columnVisibility` + `onColumnVisibilityChange`), TanStack Query v5.

---

## What we know so far

1. **Server is fine.** Direct API call to `POST /api/bases/views/update` with `{config: {hiddenPropertyIds: [...]}}` persists exactly what's sent (verified against the user's base `019c69a5-1d84-7985-a7f6-8ee2871d8669`).
2. **Client outgoing payload is wrong.** User observed: existing `hiddenPropertyIds = [A, B]`. They toggled a new column C via the hide popover. The outgoing POST payload still contained `hiddenPropertyIds: [A, B]` — C never made it in.
3. **`buildViewConfigFromTable`** (at [`use-base-table.ts:179-211`](apps/client/src/features/base/hooks/use-base-table.ts:179)) reads `table.getState().columnVisibility` and derives `hiddenPropertyIds` by filtering entries where `visible === false`.
4. **Only three code paths modify `columnVisibility` state** (confirmed by grep):
   - `use-base-table.ts:275` — view-switch full re-seed (only fires when `activeView?.id` changes).
   - `use-base-table.ts:297` — reconcile branch (function updater, preserves `prev` for existing ids).
   - `use-base-table.ts:336` — `onColumnVisibilityChange: setColumnVisibility` passed to react-table.
5. **react-table v8 `useReactTable`** ([verified from node_modules source](node_modules/.pnpm/@tanstack+react-table@8.21.3_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@tanstack/react-table/build/lib/index.mjs:47-70)) returns a STABLE `table` reference held in `useState(() => ({current: createTable(...)}))`. Every render it calls `setOptions` to merge fresh options and state. So the stale-`table`-closure hypothesis from an earlier investigation is LIKELY wrong — `table.getState()` at setTimeout time should return current state.
6. **`col.toggleVisibility(value)`** at [`@tanstack/table-core/.../ColumnVisibility.js:30`](node_modules/.pnpm/@tanstack+table-core@8.21.3/node_modules/@tanstack/table-core/build/lib/features/ColumnVisibility.js) uses a function updater: `table.setColumnVisibility(old => ({...old, [id]: value}))`. Which forwards to our `setColumnVisibility` — React queues the function updater; the next render commits new state.

Given all of that, the toggle SHOULD reach `state.columnVisibility` and SHOULD land in the debounced payload. Something is interfering that we can't see by reading.

## Hypotheses to rule in or out (the diagnostic is designed to distinguish them)

- **H1: The handler-to-setState path is broken.** `handleToggle` fires but `setColumnVisibility` never commits the toggle (e.g., the setter is somehow stale, the function updater sees a stale `prev`, or react-table's intermediate logic drops the call).
- **H2: Something immediately stomps the toggle.** The reconcile effect fires between the toggle and the debounce, with a `prev` that doesn't yet reflect the toggle, and writes an updated map that "preserves" a stale value for the toggled id.
- **H3: Debounce timer fires with a fresh closure that reads a different `table` instance.** Contradicts what we saw in the react-table source, but worth falsifying.
- **H4: The popover's `col` reference comes from a STALE `columns` memo.** If `table.getAllLeafColumns()` was captured when an older version of the table existed, `col.toggleVisibility` would call a stale `table.setColumnVisibility`.
- **H5: The state IS updated but `buildViewConfigFromTable` reads a different state shape.** E.g., internal react-table state defeats our controlled state for `columnVisibility`.

---

## File Structure

**Modified (instrumentation task — revert before shipping):**
- `apps/client/src/features/base/hooks/use-base-table.ts` — add `console.log` calls at four checkpoints.
- `apps/client/src/features/base/components/views/view-field-visibility.tsx` — log the `handleToggle` call site.

**Modified (fix task — depends on findings):**
- Whatever the diagnostic reveals.

---

## Task 1: Instrument the pipeline

**Files:**
- Modify: `apps/client/src/features/base/hooks/use-base-table.ts`
- Modify: `apps/client/src/features/base/components/views/view-field-visibility.tsx`

- [ ] **Step 1: Add a logging helper at the top of `use-base-table.ts`**

Right after the existing imports, add:
```ts
const DEBUG_HIDE = true;
function hideLog(label: string, data: unknown) {
  if (DEBUG_HIDE) console.log(`[hide-debug] ${label}`, data);
}
```

- [ ] **Step 2: Log inside the view-switch re-seed branch**

In the effect at ~line 268, inside the `if (currentViewId !== lastSyncedViewIdRef.current) { ... }` branch, add:
```ts
hideLog("VIEW_SWITCH_RESEED", {
  viewId: currentViewId,
  newOrder: derivedColumnOrder,
  newVisibility: derivedColumnVisibility,
});
```

- [ ] **Step 3: Log inside the reconcile branch's setColumnVisibility updater**

In the reconcile `setColumnVisibility((prev) => ...)` callback (around line 297), at the VERY START, log:
```ts
hideLog("RECONCILE_ENTER", { prev, derivedColumnVisibility });
```

And right before `return changed ? next : prev;`, log:
```ts
hideLog("RECONCILE_EXIT", { changed, next, returning: changed ? next : prev });
```

- [ ] **Step 4: Wrap `setColumnVisibility` to log every call**

In `useReactTable`, replace:
```ts
onColumnVisibilityChange: setColumnVisibility,
```

with an instrumented passthrough:
```ts
onColumnVisibilityChange: (updater) => {
  hideLog("RT_onColumnVisibilityChange", {
    updaterType: typeof updater,
    applied:
      typeof updater === "function"
        ? updater(columnVisibility)
        : updater,
  });
  setColumnVisibility(updater as Parameters<typeof setColumnVisibility>[0]);
},
```

(Apply the same pattern to `onColumnOrderChange` if you want symmetry — optional.)

- [ ] **Step 5: Log inside the debounced persist**

Inside the `setTimeout(() => { ... }, 300)` callback in `persistViewConfig`, BEFORE the `buildViewConfigFromTable` call, log:
```ts
const liveState = table.getState();
hideLog("PERSIST_TICK", {
  viewId: activeView.id,
  stateColumnVisibility: liveState.columnVisibility,
  stateColumnOrder: liveState.columnOrder,
});
```

AFTER `buildViewConfigFromTable`, log:
```ts
hideLog("PERSIST_OUTGOING", { config });
```

- [ ] **Step 6: Log inside `handleToggle` in the popover**

In `apps/client/src/features/base/components/views/view-field-visibility.tsx`, modify `handleToggle`:
```ts
const handleToggle = useCallback(
  (columnId: string, visible: boolean) => {
    const col = table.getColumn(columnId);
    console.log("[hide-debug] HANDLE_TOGGLE", {
      columnId,
      visibleRequested: visible,
      canHide: col?.getCanHide(),
      currentlyVisible: col?.getIsVisible(),
    });
    if (!col) return;
    col.toggleVisibility(visible);
    onPersist();
  },
  [table, onPersist],
);
```

- [ ] **Step 7: Build (do not commit — this is throwaway instrumentation)**

```bash
pnpm nx run client:build
```

Expected: success.

---

## Task 2: USER reproduces and shares logs

> ⚠️ **Do not run `pnpm dev` as an agent.** User runs dev; user hard-reloads; user interacts and copies the console output.

Hand off to the user with this script:

1. Open DevTools Console, clear it. Keep it open.
2. Open the base. Open the "Hide fields" popover.
3. Toggle ONE property that is currently visible → hidden. Do not click anything else.
4. Wait ~1 second (debounce fires).
5. Copy EVERY `[hide-debug] ...` line from the console, in order, and paste them back here. Also paste the resulting Network POST `/api/bases/views/update` request payload (Network tab → the one `update` request that fires 300 ms after the click → Payload → Request Payload).

The interesting sequence, if everything is working, is:
```
HANDLE_TOGGLE { columnId: "X", visibleRequested: false, canHide: true, currentlyVisible: true }
RT_onColumnVisibilityChange { updaterType: "function", applied: { ..., X: false } }
PERSIST_TICK { stateColumnVisibility: { ..., X: false } }
PERSIST_OUTGOING { config: { hiddenPropertyIds: [..., "X"] } }
```

If the bug is present, one of those lines will be missing or wrong. The exact position of the deviation pinpoints which hypothesis (H1–H5) is correct.

---

## Task 3: Fix based on findings

Do NOT pre-write the fix. Tasks 3a-3c below are the dispatch table — exactly ONE applies.

### Task 3a: If `RT_onColumnVisibilityChange` never logs, or `applied` doesn't include the toggled id → H1

react-table isn't calling our setter, OR the updater resolves to the wrong value. This points to:
- a stale `col` object (columns memo invalidation issue)
- or a react-table options propagation bug

Investigate `col.toggleVisibility` step-by-step (add logs inside `toggleVisibility` via a wrapped column accessor), ensure `columns` useMemo dep list includes everything that affects `getCanHide`/`getIsVisible`.

### Task 3b: If `RT_onColumnVisibilityChange` logs `applied: {X: false}` but `PERSIST_TICK` shows `stateColumnVisibility` without `X: false` → H2 or H3

The setter was called correctly but state didn't commit. Check if `RECONCILE_ENTER` fired between them and what `prev` it saw.

- If `RECONCILE_ENTER.prev` has `X: false` and `RECONCILE_EXIT.returning` does NOT → bug in the reconcile logic.
- If `RECONCILE_ENTER.prev` does NOT have `X: false` → React batching issue; the toggle's setState ran AFTER the effect's setState. Fix by using a ref to latest `derivedColumnVisibility` so the reconcile effect can safely be a no-op except on view-id change (same-view drift will be covered by `columns` prop going through react-table's internal columnVisibility seeding).

### Task 3c: If `PERSIST_TICK.stateColumnVisibility` has `X: false` but `PERSIST_OUTGOING.config.hiddenPropertyIds` doesn't include `X` → bug in `buildViewConfigFromTable`

This would be surprising given the code at [`use-base-table.ts:198-200`](apps/client/src/features/base/hooks/use-base-table.ts:198), but check type coercion and filter predicate.

---

## Task 4: Remove instrumentation, commit fix, hand back to user

- [ ] **Step 1:** Remove all `[hide-debug]` logs and the `DEBUG_HIDE` / `hideLog` helper.
- [ ] **Step 2:** Build + self-verify by thinking through the fix with the log evidence in hand.
- [ ] **Step 3:**
```bash
pnpm nx run client:build
git add <changed files>
git commit -m "fix(base): <concrete description based on the real root cause>"
```
- [ ] **Step 4:** User smoke test: hide a column, verify payload contains the id, verify the column stays hidden after refresh.

---

## Anti-goals

- **No "defensive" fixes.** We've cycled through "wrap in useRef" / "gate the effect" / "merge table state" — each touched a real issue but none hit this particular bug. A plausible-sounding fix is worse than silence: it burns trust when it doesn't work.
- **No code edits without the log evidence.** Task 3 only runs after Task 2 returns concrete data.
