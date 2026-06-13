# Base View Draft (Local-First Filter & Sort) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Source spec:** `.claude/superpowers/specs/2026-04-20-base-view-draft-design.md` — jump back there for any design-level question. This plan does not re-debate decisions.

**Goal:** Make filter and sort changes on a base view local-first. They apply instantly for the editing user, live in localStorage scoped to `(userId, baseId, viewId)`, and never touch the server baseline until the user clicks "Save for everyone". A banner at the top of the table surfaces the draft state with Reset / Save controls.

**Architecture:** A new Jotai `atomFamily(atomWithStorage)` per `(user, base, view)` triple stores a `BaseViewDraft` JSON in localStorage. A `useViewDraft` hook wraps the atom and exposes `effectiveFilter` / `effectiveSorts` / `isDirty` / setters / `reset` / `buildPromotedConfig`. `base-table.tsx` wires the hook in, swaps the raw `activeView` for an "effective" view (baseline merged with draft) when seeding `useBaseTable` and the row query, and passes the draft setters down to the toolbar in place of the current direct mutation calls. A new `BaseViewDraftBanner` mounts between page chrome and the toolbar. `useBaseTable` gains an optional `baselineConfig` so `persistViewConfig` (column layout auto-save) can never bake draft filter/sort into the server baseline.

**Tech Stack:** React 18, Jotai 2.18 (`atomWithStorage` + `atomFamily` + `RESET` sentinel from `jotai/utils`), Mantine v8 (`Paper`, `Group`, `Text`, `Button`), `@tabler/icons-react` (`IconInfoCircle`), CASL (client-side `SpaceAbility`), existing `useUpdateViewMutation` / `useSpaceQuery` / `useSpaceAbility` / `useCurrentUser` hooks.

**Scope (v1):** Filter and sort only. Column layout (widths, order, visibility) continues to auto-persist through the existing debounced `persistViewConfig` path. No server-side drafts, no "save as new view", no conflict UI, no garbage collection. See spec "Non-goals" for the full list.

**Testing note:** Per `CLAUDE.md`, `apps/client` has no `vitest` harness. Verification steps in this plan are a mix of `pnpm nx run client:build` type-checks (machine-checkable) and manual browser / DevTools checks (user-driven). No unit-test commands are invented for the client.

---

## File Structure

**New files:**
- `apps/client/src/features/base/atoms/view-draft-atom.ts` — `atomFamily(atomWithStorage)` pair keyed by `(userId, baseId, viewId)`; persists `BaseViewDraft | null` in localStorage under `docmost:base-view-draft:v1:{userId}:{baseId}:{viewId}`.
- `apps/client/src/features/base/hooks/use-view-draft.ts` — `useViewDraft` hook; derives `effective*` values, `isDirty`, exposes `setFilter` / `setSorts` / `reset` / `buildPromotedConfig`.
- `apps/client/src/features/base/components/base-view-draft-banner.tsx` — pure presentational banner shown when `isDirty === true`; "Reset" always, "Save for everyone" only if `canSave`.

**Modified files:**
- `apps/client/src/features/space/permissions/permissions.type.ts` — add `Base = "base"` to `SpaceCaslSubject`; widen `SpaceAbility` union with `[SpaceCaslAction, SpaceCaslSubject.Base]`.
- `apps/client/src/features/base/types/base.types.ts` — add the `BaseViewDraft` type.
- `apps/client/src/features/base/hooks/use-base-table.ts` — extend `useBaseTable` signature with optional `opts?: { baselineConfig?: ViewConfig }`; in `persistViewConfig` override `sorts` / `filter` with the baseline so draft values cannot leak into the layout auto-save.
- `apps/client/src/features/base/components/base-toolbar.tsx` — drop internal `useUpdateViewMutation` use for filter/sort; accept new `onDraftSortsChange` / `onDraftFiltersChange` / `activeView` props that read the effective config for badge counts.
- `apps/client/src/features/base/components/base-table.tsx` — wire `useViewDraft`; build `effectiveView` memo; pass effective view + baseline into `useBaseTable`; pass effective filter/sorts to `useBaseRowsQuery`; render `<BaseViewDraftBanner>`; add `useSpaceQuery` + `useSpaceAbility` for `canSave`; wire `handleSaveDraft`.

---

## Task 1: Add `Base` to the client-side CASL enum

**Files:**
- Modify: `apps/client/src/features/space/permissions/permissions.type.ts`

**Rationale:** The server enum ([space-ability.type.ts:14](apps/server/src/core/casl/interfaces/space-ability.type.ts)) already has `Base = 'base'` and its `ISpaceAbility` union includes it. The membership permissions returned by `useSpaceQuery` therefore contain `Base` rules today, but the client enum at [permissions.type.ts:8-12](apps/client/src/features/space/permissions/permissions.type.ts) is missing the value, so `spaceAbility.can(SpaceCaslAction.Edit, SpaceCaslSubject.Base)` doesn't type-check on the client. A ripgrep for `switch(.*SpaceCaslSubject` shows no exhaustive switches on the subject enum in the client, so adding a value is safe.

- [ ] **Step 1: Type-check baseline**

```bash
pnpm nx run client:build
```

Expected: build succeeds. This is the "no changes yet" baseline — if it already fails, stop and report.

- [ ] **Step 2: Add `Base` to the enum and widen `SpaceAbility`**

Replace the file contents:

```ts
export enum SpaceCaslAction {
  Manage = "manage",
  Create = "create",
  Read = "read",
  Edit = "edit",
  Delete = "delete",
}
export enum SpaceCaslSubject {
  Settings = "settings",
  Member = "member",
  Page = "page",
  Base = "base",
}

export type SpaceAbility =
  | [SpaceCaslAction, SpaceCaslSubject.Settings]
  | [SpaceCaslAction, SpaceCaslSubject.Member]
  | [SpaceCaslAction, SpaceCaslSubject.Page]
  | [SpaceCaslAction, SpaceCaslSubject.Base];
```

- [ ] **Step 3: Type-check after change**

```bash
pnpm nx run client:build
```

Expected: build still succeeds. (No existing caller consumes `SpaceCaslSubject.Base` yet, so this is purely additive.)

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/features/space/permissions/permissions.type.ts
git commit -m "feat(base): add Base subject to client-side space CASL enum"
```

---

## Task 2: Add `BaseViewDraft` type and the `viewDraftAtomFamily`

**Files:**
- Modify: `apps/client/src/features/base/types/base.types.ts`
- Create: `apps/client/src/features/base/atoms/view-draft-atom.ts`

- [ ] **Step 1: Append the `BaseViewDraft` type**

Add to the end of `apps/client/src/features/base/types/base.types.ts`:

```ts
// Local-first draft of filter / sort tweaks for a single view, stored in
// localStorage scoped to (userId, baseId, viewId). An absent `filter` or
// `sorts` field means "inherit the baseline for that axis". See
// `.claude/superpowers/specs/2026-04-20-base-view-draft-design.md`.
export type BaseViewDraft = {
  filter?: FilterGroup;
  sorts?: ViewSortConfig[];
  // ISO timestamp written on each put; diagnostic only, not read by logic.
  updatedAt: string;
};
```

- [ ] **Step 2: Create the atom family**

Create `apps/client/src/features/base/atoms/view-draft-atom.ts`:

```ts
import { atomFamily, atomWithStorage } from "jotai/utils";
import { BaseViewDraft } from "@/features/base/types/base.types";

export type ViewDraftKey = {
  userId: string;
  baseId: string;
  viewId: string;
};

export const viewDraftStorageKey = (k: ViewDraftKey) =>
  `docmost:base-view-draft:v1:${k.userId}:${k.baseId}:${k.viewId}`;

// `atomWithStorage` handles JSON serialization, cross-tab sync via the
// `storage` event, and lazy first-read out of the box. `atomFamily`'s
// comparator ensures the same triple resolves to the same atom instance
// across renders, so identity-equality cache hits in Jotai still work.
export const viewDraftAtomFamily = atomFamily(
  (k: ViewDraftKey) =>
    atomWithStorage<BaseViewDraft | null>(viewDraftStorageKey(k), null),
  (a, b) =>
    a.userId === b.userId && a.baseId === b.baseId && a.viewId === b.viewId,
);
```

- [ ] **Step 3: Type-check**

```bash
pnpm nx run client:build
```

Expected: build succeeds. Nothing consumes the atom yet; this is a scaffold for Task 3.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/features/base/types/base.types.ts apps/client/src/features/base/atoms/view-draft-atom.ts
git commit -m "feat(base): add BaseViewDraft type and view-draft atom family"
```

---

## Task 3: Add `useViewDraft` hook

**Files:**
- Create: `apps/client/src/features/base/hooks/use-view-draft.ts`

**Design contract (from spec):**
1. If any of `userId / baseId / viewId` is `undefined` → return a passthrough state: `draft=null`, `isDirty=false`, setters no-op, `effective*` fall through to baseline.
2. `setFilter(next)` / `setSorts(next)` compute `merged = { ...(draft ?? {}), [axis]: next, updatedAt: new Date().toISOString() }`. If both `filter` and `sorts` come out `undefined`, call `setDraft(RESET)` to remove the key.
3. `reset()` is `setDraft(RESET)`.
4. `isDirty` compares draft-vs-baseline per axis via `JSON.stringify` equality; `null/undefined` means "no divergence on that axis".
5. `buildPromotedConfig(baseline)` returns `{ ...baseline, filter: draft?.filter ?? baseline.filter, sorts: draft?.sorts ?? baseline.sorts }` — preserves all non-draft fields (widths, order, visibility).

- [ ] **Step 1: Scaffold the file**

Create `apps/client/src/features/base/hooks/use-view-draft.ts` with imports and exported types only — no logic yet. This is the "stub" in the scaffold → implement pattern:

```ts
import { useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { RESET } from "jotai/utils";
import {
  BaseViewDraft,
  FilterGroup,
  ViewConfig,
  ViewSortConfig,
} from "@/features/base/types/base.types";
import { viewDraftAtomFamily } from "@/features/base/atoms/view-draft-atom";

export type UseViewDraftArgs = {
  userId: string | undefined;
  baseId: string | undefined;
  viewId: string | undefined;
  baselineFilter: FilterGroup | undefined;
  baselineSorts: ViewSortConfig[] | undefined;
};

export type ViewDraftState = {
  draft: BaseViewDraft | null;
  effectiveFilter: FilterGroup | undefined;
  effectiveSorts: ViewSortConfig[] | undefined;
  isDirty: boolean;
  setFilter: (filter: FilterGroup | undefined) => void;
  setSorts: (sorts: ViewSortConfig[] | undefined) => void;
  reset: () => void;
  buildPromotedConfig: (baseline: ViewConfig) => ViewConfig;
};

// Passthrough shape returned when any of userId/baseId/viewId is undefined.
// Guards the initial-load window where auth / activeView hasn't resolved.
const PASSTHROUGH_DRAFT: BaseViewDraft | null = null;

export function useViewDraft(_args: UseViewDraftArgs): ViewDraftState {
  // TODO(Task 3 step 2): implement.
  throw new Error("useViewDraft: not implemented");
}
```

- [ ] **Step 2: Verify the stub type-checks**

```bash
pnpm nx run client:build
```

Expected: build succeeds (nothing imports the hook yet).

- [ ] **Step 3: Implement the hook**

Replace the stub body with the full implementation:

```ts
import { useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { RESET } from "jotai/utils";
import {
  BaseViewDraft,
  FilterGroup,
  ViewConfig,
  ViewSortConfig,
} from "@/features/base/types/base.types";
import { viewDraftAtomFamily } from "@/features/base/atoms/view-draft-atom";

export type UseViewDraftArgs = {
  userId: string | undefined;
  baseId: string | undefined;
  viewId: string | undefined;
  baselineFilter: FilterGroup | undefined;
  baselineSorts: ViewSortConfig[] | undefined;
};

export type ViewDraftState = {
  draft: BaseViewDraft | null;
  effectiveFilter: FilterGroup | undefined;
  effectiveSorts: ViewSortConfig[] | undefined;
  isDirty: boolean;
  setFilter: (filter: FilterGroup | undefined) => void;
  setSorts: (sorts: ViewSortConfig[] | undefined) => void;
  reset: () => void;
  buildPromotedConfig: (baseline: ViewConfig) => ViewConfig;
};

// JSON-stringify equality is good enough for FilterGroup (pure data tree)
// and ViewSortConfig[] — V8 preserves non-numeric key insertion order so
// the same object graph serializes identically. Avoids pulling in
// lodash/fast-deep-equal for two known-shaped types. (Spec "Dirty check".)
function filterEq(a: FilterGroup | undefined, b: FilterGroup | undefined) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
function sortsEq(
  a: ViewSortConfig[] | undefined,
  b: ViewSortConfig[] | undefined,
) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function useViewDraft(args: UseViewDraftArgs): ViewDraftState {
  const { userId, baseId, viewId, baselineFilter, baselineSorts } = args;
  const ready = !!(userId && baseId && viewId);

  // Always mount an atom with a stable shape so hook order is consistent.
  // When not ready we still feed a key, but we won't read/write it.
  const atomKey = useMemo(
    () => ({
      userId: userId ?? "",
      baseId: baseId ?? "",
      viewId: viewId ?? "",
    }),
    [userId, baseId, viewId],
  );
  const [storedDraft, setDraft] = useAtom(viewDraftAtomFamily(atomKey));

  const draft = ready ? storedDraft : null;

  const setFilter = useCallback(
    (next: FilterGroup | undefined) => {
      if (!ready) return;
      const current = storedDraft ?? null;
      const mergedFilter = next;
      const mergedSorts = current?.sorts;
      if (mergedFilter === undefined && (mergedSorts === undefined || mergedSorts === null)) {
        setDraft(RESET);
        return;
      }
      setDraft({
        filter: mergedFilter,
        sorts: mergedSorts,
        updatedAt: new Date().toISOString(),
      });
    },
    [ready, storedDraft, setDraft],
  );

  const setSorts = useCallback(
    (next: ViewSortConfig[] | undefined) => {
      if (!ready) return;
      const current = storedDraft ?? null;
      const mergedFilter = current?.filter;
      const mergedSorts = next;
      if (mergedFilter === undefined && (mergedSorts === undefined || mergedSorts === null)) {
        setDraft(RESET);
        return;
      }
      setDraft({
        filter: mergedFilter,
        sorts: mergedSorts,
        updatedAt: new Date().toISOString(),
      });
    },
    [ready, storedDraft, setDraft],
  );

  const reset = useCallback(() => {
    if (!ready) return;
    setDraft(RESET);
  }, [ready, setDraft]);

  const effectiveFilter = useMemo(
    () => (draft?.filter !== undefined ? draft.filter : baselineFilter),
    [draft?.filter, baselineFilter],
  );
  const effectiveSorts = useMemo(
    () => (draft?.sorts !== undefined ? draft.sorts : baselineSorts),
    [draft?.sorts, baselineSorts],
  );

  const isDirty = useMemo(() => {
    if (!draft) return false;
    const filterDirty =
      draft.filter !== undefined && !filterEq(draft.filter, baselineFilter);
    const sortsDirty =
      draft.sorts !== undefined && !sortsEq(draft.sorts, baselineSorts);
    return filterDirty || sortsDirty;
  }, [draft, baselineFilter, baselineSorts]);

  const buildPromotedConfig = useCallback(
    (baseline: ViewConfig): ViewConfig => ({
      ...baseline,
      filter: draft?.filter ?? baseline.filter,
      sorts: draft?.sorts ?? baseline.sorts,
    }),
    [draft],
  );

  if (!ready) {
    return {
      draft: null,
      effectiveFilter: baselineFilter,
      effectiveSorts: baselineSorts,
      isDirty: false,
      setFilter: () => {},
      setSorts: () => {},
      reset: () => {},
      buildPromotedConfig: (baseline) => baseline,
    };
  }

  return {
    draft,
    effectiveFilter,
    effectiveSorts,
    isDirty,
    setFilter,
    setSorts,
    reset,
    buildPromotedConfig,
  };
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm nx run client:build
```

Expected: build succeeds. Hook has no consumers yet (Task 5 will wire it in).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/features/base/hooks/use-view-draft.ts
git commit -m "feat(base): add useViewDraft hook for local filter/sort drafts"
```

---

## Task 4: Extend `useBaseTable` with `baselineConfig` option

**Files:**
- Modify: `apps/client/src/features/base/hooks/use-base-table.ts` (signature ~line 224-228; `persistViewConfig` body ~line 371-396; exact block is `buildViewConfigFromTable(table, activeView.config)` at line 382)

**Why:** Once `base-table.tsx` starts passing an `effectiveView` into `useBaseTable` (Task 5), the table's live `sorting` state will be seeded from the draft. The debounced `persistViewConfig` reads `state.sorting` (via `buildViewConfigFromTable`) and writes it back to the server — which would silently bake the draft into the server baseline every time the user resizes or reorders a column. The fix is: `persistViewConfig` overrides `sorts` and `filter` in the emitted config with the **real baseline** values, not the effective ones. To keep the hook's responsibilities tidy, existing callers stay unchanged — a new optional `opts.baselineConfig` parameter carries the baseline.

- [ ] **Step 1: Change the signature**

In `use-base-table.ts` find:

```ts
export function useBaseTable(
  base: IBase | undefined,
  rows: IBaseRow[],
  activeView: IBaseView | undefined,
): UseBaseTableResult {
```

Replace with:

```ts
export type UseBaseTableOptions = {
  // When provided, `persistViewConfig` uses this as the authoritative
  // filter/sorts for the server write. The table's live sorting state is
  // ignored for that axis so a locally-drafted sort/filter (kept in
  // `activeView.config` for rendering purposes) cannot leak into the
  // auto-persist column-layout path. Optional to preserve existing
  // callers that pass the real baseline as `activeView`.
  baselineConfig?: ViewConfig;
};

export function useBaseTable(
  base: IBase | undefined,
  rows: IBaseRow[],
  activeView: IBaseView | undefined,
  opts: UseBaseTableOptions = {},
): UseBaseTableResult {
```

- [ ] **Step 2: Use `baselineConfig` inside `persistViewConfig`**

Find the `persistViewConfig` `useCallback` at ~line 371 and the `buildViewConfigFromTable(table, activeView.config)` call at ~line 382. Replace the inner body:

Before (line 382):

```ts
const config = buildViewConfigFromTable(table, activeView.config);
```

After:

```ts
// `baseline` is the server-side-of-truth config. When the caller has
// wrapped `activeView` with draft filter/sort values for render, they
// pass the pre-wrap config here so we never round-trip drafts through
// the column-layout auto-save path.
const baseline = opts.baselineConfig ?? activeView.config;
const config = buildViewConfigFromTable(table, baseline, {
  sorts: baseline?.sorts,
  filter: baseline?.filter,
});
```

Also update the `persistViewConfig` dependency list at line 396 from `[activeView, base, table, updateViewMutation]` to `[activeView, base, table, updateViewMutation, opts.baselineConfig]`.

- [ ] **Step 3: Type-check**

```bash
pnpm nx run client:build
```

Expected: build succeeds. Existing callers (just `base-table.tsx` so far) didn't pass `opts`, so they get `baselineConfig: undefined` → `baseline = activeView.config` → behavior unchanged.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/features/base/hooks/use-base-table.ts
git commit -m "refactor(base): accept baselineConfig option in useBaseTable"
```

---

## Task 5: Integrate `useViewDraft` into `base-table.tsx` (render path only)

**Files:**
- Modify: `apps/client/src/features/base/components/base-table.tsx` (imports near top; `activeView` memo ~line 40-43; rows query call ~line 52-53; `useBaseTable` call at line 88)

**Scope:** Only the **render path**. At the end of this task:
- The table renders from effective (draft-or-baseline) values.
- The row query fetches using effective values.
- Filters/sorts still auto-persist via the existing toolbar handlers (Task 6 rewires that).
- No banner yet (Task 7/8).

**Manual pre-test with DevTools:** At the end of the task, verify drafts render correctly by seeding localStorage directly.

- [ ] **Step 1: Add imports**

At the top of `base-table.tsx`, add:

```tsx
import useCurrentUser from "@/features/user/hooks/use-current-user";
import { useViewDraft } from "@/features/base/hooks/use-view-draft";
```

- [ ] **Step 2: Wire the draft hook and build `effectiveView`**

Insert after the `activeView` memo (currently at line 40-43 — the `useMemo` that resolves `activeView` from `views` and `activeViewId`), before the `activeFilter` / `activeSorts` lines:

```tsx
const { data: currentUser } = useCurrentUser();
const {
  draft: _draft,
  effectiveFilter,
  effectiveSorts,
  isDirty,
  setFilter: setDraftFilter,
  setSorts: setDraftSorts,
  reset: resetDraft,
  buildPromotedConfig,
} = useViewDraft({
  userId: currentUser?.user.id,
  baseId,
  viewId: activeView?.id,
  baselineFilter: activeView?.config?.filter,
  baselineSorts: activeView?.config?.sorts,
});

// Render view: baseline merged with any local draft. Passed to
// `useBaseTable` (for table state seeding) and to the toolbar (for badge
// counts). The real `activeView` is still used as the auto-persist
// baseline so drafts can't leak into column-layout writes.
const effectiveView = useMemo(
  () =>
    activeView
      ? {
          ...activeView,
          config: {
            ...activeView.config,
            filter: effectiveFilter,
            sorts: effectiveSorts,
          },
        }
      : undefined,
  [activeView, effectiveFilter, effectiveSorts],
);
```

- [ ] **Step 3: Replace the `activeFilter` / `activeSorts` lines**

Before (~line 45-46):

```tsx
const activeFilter = activeView?.config?.filter;
const activeSorts = activeView?.config?.sorts;
```

After:

```tsx
// Effective values drive the row query and the client-side position
// sort guard below. The old `activeView.config` reads are no longer the
// source of truth once drafts are involved.
const activeFilter = effectiveFilter;
const activeSorts = effectiveSorts;
```

(Renaming is intentionally minimal — downstream usages of `activeSorts` / `activeFilter` at `useBaseRowsQuery(...)` and in the position-sort memo keep working without further edits.)

- [ ] **Step 4: Pass `effectiveView` + `baselineConfig` into `useBaseTable`**

Before (~line 88):

```tsx
const { table, persistViewConfig } = useBaseTable(base, rows, activeView);
```

After:

```tsx
const { table, persistViewConfig } = useBaseTable(base, rows, effectiveView, {
  baselineConfig: activeView?.config,
});
```

- [ ] **Step 5: Type-check**

```bash
pnpm nx run client:build
```

Expected: build succeeds. `isDirty`, `setDraftFilter`, `setDraftSorts`, `resetDraft`, `buildPromotedConfig` are declared-but-unused at this step; that's intentional — Tasks 6 and 8 consume them. TypeScript `noUnusedLocals` is not enabled in the client's `tsconfig` (check with `pnpm nx run client:build` — if it errors on unused, prefix with `_`).

- [ ] **Step 6: Manual DevTools verification — USER-DRIVEN**

> Do not run `pnpm dev` as an agent. Hand off to the user.

Ask the user to:

1. Run `pnpm dev` and open any base in the browser.
2. In DevTools → Application → Local Storage, note the current user id from the cookie or any existing `docmost:*` key, then note the base id from the URL and the active view id (visible in the `activeViewId` atom via React DevTools, or pick the first view's id from the `["bases", baseId]` query data).
3. In DevTools console:

   ```js
   // Seed a dummy draft that sorts by any existing propertyId desc.
   const key = `docmost:base-view-draft:v1:${USER_ID}:${BASE_ID}:${VIEW_ID}`;
   localStorage.setItem(key, JSON.stringify({
     sorts: [{ propertyId: "<ANY_PROP_UUID>", direction: "desc" }],
     updatedAt: new Date().toISOString(),
   }));
   location.reload();
   ```

Expected after reload:
- Rows appear sorted by the seeded propertyId descending.
- The sort popover badge shows `1`.
- The sort popover, when opened, shows the drafted sort entry.

Then run:

```js
localStorage.removeItem(key);
location.reload();
```

Expected: rows revert to the baseline order; badge clears.

If either side fails, stop and diagnose. Do not proceed to Task 6.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/features/base/components/base-table.tsx
git commit -m "feat(base): render table from effective (draft-or-baseline) view config"
```

---

## Task 6: Rewire toolbar to write drafts instead of persisting immediately

**Files:**
- Modify: `apps/client/src/features/base/components/base-toolbar.tsx` (remove `useUpdateViewMutation` / `buildViewConfigFromTable` usage for sort/filter — lines 19, 20, 116, 135-148, 150-169; badge sources at 118, 122-128; props type at 29-37)
- Modify: `apps/client/src/features/base/components/base-table.tsx` (pass the new callbacks + effective view into `<BaseToolbar>`, ~line 192-200)

**Why:** Today `handleSortsChange` and `handleFiltersChange` call `updateViewMutation.mutate(...)` directly — that's the "every change persists to everyone" behavior we're replacing. The toolbar gets two new callbacks (`onDraftSortsChange`, `onDraftFiltersChange`) from the parent and drops its internal mutation for these two axes. Badge counts must read from `effectiveView.config` so they reflect the user's draft, not the baseline.

- [ ] **Step 1: Change the toolbar's props type**

In `base-toolbar.tsx`, replace the `BaseToolbarProps` type (line 29-37):

Before:

```ts
type BaseToolbarProps = {
  base: IBase;
  activeView: IBaseView | undefined;
  views: IBaseView[];
  table: Table<IBaseRow>;
  onViewChange: (viewId: string) => void;
  onAddView?: () => void;
  onPersistViewConfig: () => void;
};
```

After:

```ts
type BaseToolbarProps = {
  base: IBase;
  // Effective view — baseline merged with any local draft. Badge counts
  // and sort/filter popover seed data read from this. The real baseline
  // only enters via `onDraftSortsChange` / `onDraftFiltersChange`
  // callbacks defined by the parent.
  activeView: IBaseView | undefined;
  views: IBaseView[];
  table: Table<IBaseRow>;
  onViewChange: (viewId: string) => void;
  onAddView?: () => void;
  onPersistViewConfig: () => void;
  onDraftSortsChange: (sorts: ViewSortConfig[] | undefined) => void;
  onDraftFiltersChange: (filter: FilterGroup | undefined) => void;
};
```

Destructure the two new props in the function signature:

Before (line 39-47):

```ts
export function BaseToolbar({
  base,
  activeView,
  views,
  table,
  onViewChange,
  onAddView,
  onPersistViewConfig,
}: BaseToolbarProps) {
```

After:

```ts
export function BaseToolbar({
  base,
  activeView,
  views,
  table,
  onViewChange,
  onAddView,
  onPersistViewConfig,
  onDraftSortsChange,
  onDraftFiltersChange,
}: BaseToolbarProps) {
```

- [ ] **Step 2: Remove the now-unused `updateViewMutation` and `buildViewConfigFromTable` imports/calls for sort/filter**

The toolbar's `useUpdateViewMutation()` call at line 116 is only used by `handleSortsChange` and `handleFiltersChange`. Both are being rewritten. Delete:

- The import at line 19:
  ```ts
  import { useUpdateViewMutation } from "@/features/base/queries/base-view-query";
  ```
- The import at line 20:
  ```ts
  import { buildViewConfigFromTable } from "@/features/base/hooks/use-base-table";
  ```
- The `const updateViewMutation = useUpdateViewMutation();` line at 116.

- [ ] **Step 3: Rewrite the two handlers**

Replace `handleSortsChange` (lines 135-148):

Before:

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

After:

```ts
const handleSortsChange = useCallback(
  (newSorts: ViewSortConfig[]) => {
    // Normalize empty to undefined so the draft hook can drop the `sorts`
    // axis (and remove its localStorage entry when both axes go clean).
    onDraftSortsChange(newSorts.length > 0 ? newSorts : undefined);
  },
  [onDraftSortsChange],
);
```

Replace `handleFiltersChange` (lines 150-169):

Before:

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

After:

```ts
const handleFiltersChange = useCallback(
  (newConditions: FilterCondition[]) => {
    // Wrap the AND-flat popover output into the engine's FilterGroup shape.
    // Pass `undefined` to drop the filter axis from the draft entirely.
    const filter: FilterGroup | undefined =
      newConditions.length > 0
        ? { op: "and", children: newConditions }
        : undefined;
    onDraftFiltersChange(filter);
  },
  [onDraftFiltersChange],
);
```

- [ ] **Step 4: Wire the new callbacks + effective view in `base-table.tsx`**

In `base-table.tsx`, near the existing callback block (before the `return`), add:

```tsx
const handleDraftSortsChange = useCallback(
  (sorts: ViewSortConfig[] | undefined) => {
    setDraftSorts(sorts && sorts.length > 0 ? sorts : undefined);
  },
  [setDraftSorts],
);

const handleDraftFiltersChange = useCallback(
  (filter: FilterGroup | undefined) => {
    setDraftFilter(filter);
  },
  [setDraftFilter],
);
```

Add the imports needed for the callback types:

```tsx
import {
  FilterGroup,
  ViewSortConfig,
} from "@/features/base/types/base.types";
```

Update the `<BaseToolbar>` JSX (currently at ~line 192-200) to pass `effectiveView` instead of `activeView` AND the two new callbacks:

Before:

```tsx
<BaseToolbar
  base={base}
  activeView={activeView}
  views={views}
  table={table}
  onViewChange={handleViewChange}
  onAddView={handleAddView}
  onPersistViewConfig={persistViewConfig}
/>
```

After:

```tsx
<BaseToolbar
  base={base}
  activeView={effectiveView}
  views={views}
  table={table}
  onViewChange={handleViewChange}
  onAddView={handleAddView}
  onPersistViewConfig={persistViewConfig}
  onDraftSortsChange={handleDraftSortsChange}
  onDraftFiltersChange={handleDraftFiltersChange}
/>
```

- [ ] **Step 5: Type-check**

```bash
pnpm nx run client:build
```

Expected: build succeeds. The toolbar's sort/filter badges now derive from `effectiveView.config` (because the parent passes `effectiveView` as `activeView`) — no further toolbar edits needed for the badge count issue flagged in the spec.

- [ ] **Step 6: Manual verification — USER-DRIVEN**

Ask the user to:

1. Open a base in the browser.
2. Open the filter popover, add a filter (pick any property → any op → any value).
3. Observe: the row list updates locally, filter badge shows `1`.
4. Open DevTools → Application → Local Storage → look for `docmost:base-view-draft:v1:...`. Expected: entry present with the filter in JSON.
5. Hard-refresh (cmd+shift+R). The filter still applies locally.
6. Open the base in an incognito window (same base URL) as a different user — or ask a teammate. Expected: no filter applied; the baseline view is unchanged.

If step 5 or step 6 fails, stop and diagnose.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/features/base/components/base-toolbar.tsx apps/client/src/features/base/components/base-table.tsx
git commit -m "feat(base): route toolbar sort/filter changes through local draft"
```

---

## Task 7: Build the `BaseViewDraftBanner` component

**Files:**
- Create: `apps/client/src/features/base/components/base-view-draft-banner.tsx`

Pure presentational. No data fetching, no state. Mounts the banner only when `isDirty === true` and shows "Reset" always, "Save for everyone" only when `canSave`.

- [ ] **Step 1: Create the component file**

Create `apps/client/src/features/base/components/base-view-draft-banner.tsx`:

```tsx
import { Paper, Group, Text, Button } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

type BaseViewDraftBannerProps = {
  isDirty: boolean;
  canSave: boolean;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
};

export function BaseViewDraftBanner({
  isDirty,
  canSave,
  onReset,
  onSave,
  saving,
}: BaseViewDraftBannerProps) {
  const { t } = useTranslation();
  if (!isDirty) return null;
  return (
    <Paper withBorder radius="sm" px="md" py="xs" bg="yellow.0">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <IconInfoCircle size={16} />
          <Text size="sm">
            {t("Filter and sort changes are visible only to you.")}
          </Text>
        </Group>
        <Group gap="sm" wrap="nowrap">
          <Button variant="subtle" color="gray" size="xs" onClick={onReset}>
            {t("Reset")}
          </Button>
          {canSave && (
            <Button size="xs" onClick={onSave} loading={saving}>
              {t("Save for everyone")}
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm nx run client:build
```

Expected: build succeeds. Component has no consumers yet.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/base/components/base-view-draft-banner.tsx
git commit -m "feat(base): add view draft banner component"
```

---

## Task 8: Mount the banner and wire the save flow in `base-table.tsx`

**Files:**
- Modify: `apps/client/src/features/base/components/base-table.tsx`

**What this task adds:**
- `useSpaceQuery` + `useSpaceAbility` → `canSave = spaceAbility.can(SpaceCaslAction.Edit, SpaceCaslSubject.Base)`.
- `useUpdateViewMutation` hook invocation at the page level.
- `handleSaveDraft` callback that composes `buildPromotedConfig(activeView.config)` → `updateViewMutation.mutateAsync(...)` → `resetDraft()` → success toast.
- `<BaseViewDraftBanner>` mounted between page chrome and `<BaseToolbar>`.

- [ ] **Step 1: Add imports**

Add to the top of `base-table.tsx`:

```tsx
import { notifications } from "@mantine/notifications";
import { useSpaceQuery } from "@/features/space/queries/space-query";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type";
import { useUpdateViewMutation } from "@/features/base/queries/base-view-query";
import { BaseViewDraftBanner } from "@/features/base/components/base-view-draft-banner";
```

- [ ] **Step 2: Wire the space ability and the save handler**

Insert after the `useViewDraft` / `effectiveView` block, before the `useBaseRowsQuery` call:

```tsx
// `useSpaceQuery` is guarded by `enabled: !!spaceId` internally, so
// passing `""` when `base` hasn't loaded yet is safe. See
// use-history-restore.tsx for the same pattern.
const { data: space } = useSpaceQuery(base?.spaceId ?? "");
const spaceAbility = useSpaceAbility(space?.membership?.permissions);
const canSave = spaceAbility.can(
  SpaceCaslAction.Edit,
  SpaceCaslSubject.Base,
);

const updateViewMutation = useUpdateViewMutation();

const handleSaveDraft = useCallback(async () => {
  if (!activeView || !base) return;
  // `buildPromotedConfig` preserves all non-draft baseline fields
  // (widths/order/visibility) and only overwrites filter/sorts when the
  // draft has divergent values.
  const config = buildPromotedConfig(activeView.config);
  try {
    await updateViewMutation.mutateAsync({
      viewId: activeView.id,
      baseId: base.id,
      config,
    });
    resetDraft();
    notifications.show({ message: t("View updated for everyone") });
  } catch {
    // `useUpdateViewMutation` already shows a red toast on error and
    // rolls back the optimistic cache; keep the draft so the user can
    // retry without re-typing.
  }
}, [
  activeView,
  base,
  buildPromotedConfig,
  resetDraft,
  t,
  updateViewMutation,
]);
```

- [ ] **Step 3: Mount the banner**

Update the `return` block. Before (~line 190-215):

```tsx
return (
  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    <BaseToolbar ... />
    <GridContainer ... />
  </div>
);
```

After:

```tsx
return (
  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    <BaseViewDraftBanner
      isDirty={isDirty}
      canSave={canSave}
      onReset={resetDraft}
      onSave={handleSaveDraft}
      saving={updateViewMutation.isPending}
    />
    <BaseToolbar
      base={base}
      activeView={effectiveView}
      views={views}
      table={table}
      onViewChange={handleViewChange}
      onAddView={handleAddView}
      onPersistViewConfig={persistViewConfig}
      onDraftSortsChange={handleDraftSortsChange}
      onDraftFiltersChange={handleDraftFiltersChange}
    />
    <GridContainer
      table={table}
      properties={base.properties}
      onCellUpdate={handleCellUpdate}
      onAddRow={handleAddRow}
      baseId={baseId}
      onColumnReorder={handleColumnReorder}
      onResizeEnd={handleResizeEnd}
      onRowReorder={handleRowReorder}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onFetchNextPage={fetchNextPage}
    />
  </div>
);
```

(The `<BaseToolbar>` / `<GridContainer>` props are re-listed verbatim from Task 6 — no behavioral change to them here; this step only adds the banner above.)

- [ ] **Step 4: Type-check**

```bash
pnpm nx run client:build
```

Expected: build succeeds. The previously "declared-but-unused" `isDirty`, `resetDraft`, and `buildPromotedConfig` are now consumed.

- [ ] **Step 5: Manual verification — USER-DRIVEN**

Ask the user to:

1. Open a base.
2. Apply a filter via the popover.
   - Expected: the yellow banner appears with info icon + "Filter and sort changes are visible only to you." on the left; "Reset" and "Save for everyone" on the right.
3. Click **Reset**.
   - Expected: banner disappears; filter popover badge clears; rows revert to baseline.
4. Apply a filter again. Click **Save for everyone**.
   - Expected: banner disappears; notification "View updated for everyone" appears.
5. Hard-refresh the page.
   - Expected: filter is still applied (baseline has caught up). No banner.
6. Open the same base in a second browser profile / incognito as a different user.
   - Expected: that user sees the saved filter.
7. As a viewer (a user with Read but not Edit on Base): open the base, apply a filter.
   - Expected: banner appears but only shows "Reset" — no "Save for everyone" button.

If any of these fails, stop and diagnose.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/features/base/components/base-table.tsx
git commit -m "feat(base): mount draft banner and wire save-for-everyone flow"
```

---

## Task 9: Final manual QA pass — USER-DRIVEN

> Do not run `pnpm dev` as an agent. Ask the user to step through the spec's "Manual QA checklist" end-to-end. This is a verification task, not a commit task. If any check fails, open a sub-task to fix before continuing.

Reference: spec section "Manual QA checklist" (`.claude/superpowers/specs/2026-04-20-base-view-draft-design.md` lines 425-451).

- [ ] **Step 1: Single user, single tab**
  - Apply a filter → banner appears, row list updates locally.
  - Click Reset → banner disappears, filter popover reverts, rows revert.
  - Apply a filter and a sort → click Save for everyone → banner disappears → refresh → filter/sort is the new baseline.
  - Apply a filter then delete it via the popover → banner disappears → refresh → baseline unchanged (no deleted filter restored).

- [ ] **Step 2: Single user, multiple tabs**
  - Open base in tab A and tab B.
  - In tab A, add a sort → tab B re-renders with the same sort (badge + row order) → tab B shows the banner.
  - In tab B, click Reset → tab A's banner disappears and sort reverts.

- [ ] **Step 3: Multi-user baseline race**
  - User X (editor) opens base, applies a filter (draft).
  - User Y (another editor) saves a new baseline via their own Save flow.
  - User X's client receives the websocket `base:schema:bumped` → `["bases", baseId]` invalidates → `activeView.config` updates.
  - Expected: X's `effectiveFilter` still shows X's draft filter. Banner stays. No UI prompt.
  - X clicks Reset → X sees Y's new baseline.

- [ ] **Step 4: Permission gating**
  - Log in as a space Viewer (Read but not Edit on `Base`).
  - Open base, apply a filter.
  - Expected: banner appears but shows only "Reset" — no "Save for everyone" button.

- [ ] **Step 5: Reset with popover open**
  - Open the filter popover, add conditions.
  - Without closing the popover, click Reset (the banner is above the popover).
  - Expected: popover closes on outside-click; the next open shows baseline conditions.

- [ ] **Step 6: Save clears draft + updates server**
  - Save. Banner vanishes.
  - In DevTools → Application → Local Storage: `docmost:base-view-draft:v1:{user}:{base}:{view}` is absent.
  - Open the base in incognito / second-account browser: the filter/sort is present from the server.

- [ ] **Step 7: Browser storage cleared**
  - In DevTools, wipe `localStorage`.
  - Expected: base re-renders with baseline, banner gone.

- [ ] **Step 8: Column layout still auto-saves (regression check)**
  - With a filter draft active, drag a column to reorder.
  - Wait ~1s for the debounce.
  - Expected: column order persists (open base in another tab; order matches) AND the filter draft remains a draft (baseline's filter on the server is still the pre-draft state). Verify via the server API or a second-account browser.

---

## Follow-ups (out of scope for v1)

- Draft column layout (widths, order, visibility) — spec "Future extension #1".
- Server-side per-user drafts for cross-device sync — spec "Future extension #2".
- "Save as new view" split-button — spec "Future extension #3".
- Baseline-changed hint inside the banner — spec "Future extension #4".
- One-time in-product hint explaining the new draft-then-save behavior — spec "Rollout" mitigation note.
