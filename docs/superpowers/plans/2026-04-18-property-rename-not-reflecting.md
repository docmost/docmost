# Property Rename Not Reflecting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make property (column) rename reflect immediately in the grid header and the hide-fields popover, both for the editing user and other clients in the same base room — without a tab reload.

**Architecture:** Three small frontend changes. The server path is already correct (rename persists, emits `base:property:updated` ws event, and `useBaseSocket` invalidates `["bases", baseId]`). The cache updates too. The bug is purely client-side memoization: `GridHeader`, `GridHeaderCell`, and `ViewFieldVisibility` memo on `[table]` / their prop object — and the `table` reference returned by `useReactTable` is STABLE across renders. So when properties change under the hood (new column defs, new `meta.property` objects, new header strings), memo'd consumers never re-render. Fix: thread `properties` / `property` down as explicit props so shallow-compare catches the change.

**Tech Stack:** React 18, TanStack Table v8, TanStack Query v5.

---

## Background — the trace that explains the bug

1. User renames property "Email" → "Mail" from the header's property menu.
2. `updatePropertyMutation.mutate` fires. Server persists, returns `{property: {...name: "Mail"}}`.
3. `onSuccess` in [`base-property-query.ts:52-65`](apps/client/src/features/base/queries/base-property-query.ts:52) calls `queryClient.setQueryData(["bases", baseId], old => ({...old, properties: old.properties.map(p => p.id === result.property.id ? result.property : p)}))`. The renamed property is a new object reference; the rest of the array reuses old refs.
4. `useBaseQuery` returns a new `IBase` object with a new `properties` array.
5. In [`use-base-table.ts`](apps/client/src/features/base/hooks/use-base-table.ts), `properties = useMemo(() => base?.properties ?? [], [base?.properties])` picks up the new array. `columns = useMemo(() => buildColumns(properties), [properties])` rebuilds all column defs, including new `meta.property` objects and new `header: property.name` values.
6. `useReactTable({columns, ...})` receives the new columns array. Internally TanStack Table updates its column state.
7. The `table` instance returned by `useReactTable` is the SAME reference it was before — it's memoized for stability.
8. `<GridHeader table={table} columnOrder={...} />` is wrapped in `React.memo`. Its props: `table` (stable), `columnOrder` (unchanged — rename doesn't reorder), `loadedRowIds` (unchanged). Memo shallow-compare says "no change" → **no re-render**.
9. Even if `GridHeader` did re-render, each `<GridHeaderCell key={header.id} header={header} />` is also `memo`'d. `header` is reused by TanStack Table across renders for the same column id, so same ref → memo skips → **no re-render**.
10. [`view-field-visibility.tsx:27-31`](apps/client/src/features/base/components/views/view-field-visibility.tsx:27): `const columns = useMemo(() => table.getAllLeafColumns().filter(...), [table])`. `table` is stable → memo never invalidates → shows stale names.

The rename only becomes visible after a full mount (tab reload), which recomputes everything from scratch.

## Files

**Modified:**
- `apps/client/src/features/base/components/grid/grid-header.tsx` — accept `properties: IBaseProperty[]` prop; pass `property={...}` to each `GridHeaderCell`. Memo picks up the change.
- `apps/client/src/features/base/components/grid/grid-header-cell.tsx` — accept `property` as an explicit prop instead of deriving from `header.column.columnDef.meta?.property`. Use it for header rendering (and anywhere else in this file that currently reads it through the meta).
- `apps/client/src/features/base/components/grid/grid-container.tsx` — accept `properties` prop; pass to `<GridHeader>`.
- `apps/client/src/features/base/components/base-table.tsx` — pass `base?.properties` to `<GridContainer>`.
- `apps/client/src/features/base/components/base-toolbar.tsx` — pass `properties={base.properties}` to `<ViewFieldVisibility>`.
- `apps/client/src/features/base/components/views/view-field-visibility.tsx` — accept `properties` prop; include it in the `useMemo([table, properties])` dep list.

No new files. No server changes. No new deps.

---

## Task 1: `GridHeaderCell` — accept `property` as a prop

**Files:**
- Modify: `apps/client/src/features/base/components/grid/grid-header-cell.tsx`

- [ ] **Step 1: Add `property` to `GridHeaderCellProps`**

```tsx
type GridHeaderCellProps = {
  header: Header<IBaseRow, unknown>;
  property: IBaseProperty | undefined;
  loadedRowIds: string[];
};
```

- [ ] **Step 2: Replace the internal property derivation with the prop**

Find the line near the top of the component:
```tsx
const property = header.column.columnDef.meta?.property as
  | IBaseProperty
  | undefined;
```

Remove it. Add `property` to the function parameter destructuring:
```tsx
export const GridHeaderCell = memo(function GridHeaderCell({
  header,
  property,
  loadedRowIds,
}: GridHeaderCellProps) {
```

Everything else in the file continues to reference the same `property` variable, now a prop. No further changes needed in this file.

- [ ] **Step 3: Build**

```bash
pnpm nx run client:build
```

Build will FAIL because `GridHeader` doesn't yet pass `property`. That's fine — fixed in the next task. Do not commit yet.

---

## Task 2: `GridHeader` — thread `properties` / `property` through

**Files:**
- Modify: `apps/client/src/features/base/components/grid/grid-header.tsx`

- [ ] **Step 1: Add `properties` prop and use it to look up per-cell property**

Before:
```tsx
type GridHeaderProps = {
  table: Table<IBaseRow>;
  baseId?: string;
  // Passed explicitly to break memo when columns change
  // (table ref is stable from useReactTable, so memo won't fire without this)
  columnOrder: ColumnOrderState;
  loadedRowIds: string[];
  onPropertyCreated?: () => void;
};

export const GridHeader = memo(function GridHeader({
  table,
  baseId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  columnOrder: _columnOrder,
  loadedRowIds,
  onPropertyCreated,
}: GridHeaderProps) {
  const headerGroups = table.getHeaderGroups();

  return (
    <div className={classes.headerRow} role="row">
      {headerGroups[0]?.headers.map((header) => (
        <GridHeaderCell key={header.id} header={header} loadedRowIds={loadedRowIds} />
      ))}
      ...
```

After:
```tsx
import { IBaseProperty, IBaseRow } from "@/features/base/types/base.types";

type GridHeaderProps = {
  table: Table<IBaseRow>;
  baseId?: string;
  // Passed explicitly to break memo when columns change
  // (table ref is stable from useReactTable, so memo won't fire without these)
  columnOrder: ColumnOrderState;
  properties: IBaseProperty[];
  loadedRowIds: string[];
  onPropertyCreated?: () => void;
};

export const GridHeader = memo(function GridHeader({
  table,
  baseId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  columnOrder: _columnOrder,
  properties,
  loadedRowIds,
  onPropertyCreated,
}: GridHeaderProps) {
  const headerGroups = table.getHeaderGroups();
  const propertyById = useMemo(() => {
    const map = new Map<string, IBaseProperty>();
    for (const p of properties) map.set(p.id, p);
    return map;
  }, [properties]);

  return (
    <div className={classes.headerRow} role="row">
      {headerGroups[0]?.headers.map((header) => (
        <GridHeaderCell
          key={header.id}
          header={header}
          property={propertyById.get(header.column.id)}
          loadedRowIds={loadedRowIds}
        />
      ))}
      ...
```

Make sure `useMemo` is imported from react (it already imports `memo`; add `useMemo` alongside).

- [ ] **Step 2: Build**

```bash
pnpm nx run client:build
```

Still expected to fail — `GridContainer` doesn't yet pass `properties`. Next task.

---

## Task 3: `GridContainer` — accept and forward `properties`

**Files:**
- Modify: `apps/client/src/features/base/components/grid/grid-container.tsx`

- [ ] **Step 1: Add `properties` to props**

Near the existing `GridContainerProps` type (look near the top of the file), add:
```tsx
properties: IBaseProperty[];
```

Add `IBaseProperty` to the existing `@/features/base/types/base.types` import at the top of the file if it's not already imported.

Destructure it in the component signature.

- [ ] **Step 2: Pass it to `<GridHeader>`**

Find the `<GridHeader ... />` JSX at roughly line 239-245 and add:
```tsx
<GridHeader
  table={table}
  baseId={baseId}
  columnOrder={table.getState().columnOrder}
  properties={properties}
  loadedRowIds={rowIds}
  onPropertyCreated={handlePropertyCreated}
/>
```

- [ ] **Step 3: Build**

Still expected to fail — `BaseTable` doesn't yet pass `properties` to `GridContainer`. Next task.

---

## Task 4: `BaseTable` — pass `base.properties` to `GridContainer`

**Files:**
- Modify: `apps/client/src/features/base/components/base-table.tsx`

- [ ] **Step 1: Add the prop**

Find the `<GridContainer ... />` JSX at line 187. Add:
```tsx
<GridContainer
  table={table}
  properties={base.properties}
  onCellUpdate={handleCellUpdate}
  ...
/>
```

`base` is already guaranteed non-null at this point — line 174 has `if (!base) return null;`.

- [ ] **Step 2: Build**

```bash
pnpm nx run client:build
```

Should succeed now — grid path is complete.

- [ ] **Step 3: Commit the grid-side changes as one unit**

```bash
git add \
  apps/client/src/features/base/components/grid/grid-header-cell.tsx \
  apps/client/src/features/base/components/grid/grid-header.tsx \
  apps/client/src/features/base/components/grid/grid-container.tsx \
  apps/client/src/features/base/components/base-table.tsx
git commit -m "fix(base): refresh grid headers when a property is renamed"
```

The four files have to land together or the build is broken — one commit.

---

## Task 5: `ViewFieldVisibility` — accept `properties` and include it in the memo

**Files:**
- Modify: `apps/client/src/features/base/components/views/view-field-visibility.tsx`

- [ ] **Step 1: Add `properties` to the props type**

```tsx
type ViewFieldVisibilityProps = {
  opened: boolean;
  onClose: () => void;
  table: Table<IBaseRow>;
  properties: IBaseProperty[];
  onPersist: () => void;
  children: React.ReactNode;
};
```

- [ ] **Step 2: Add `properties` to the `useMemo` dep list**

Change:
```tsx
const columns = useMemo(() => {
  return table
    .getAllLeafColumns()
    .filter((col) => col.id !== "__row_number");
}, [table]);
```

To:
```tsx
const columns = useMemo(() => {
  return table
    .getAllLeafColumns()
    .filter((col) => col.id !== "__row_number");
}, [table, properties]);
```

We still derive columns from `table` (that's where `col.getIsVisible()` / `col.getCanHide()` live), but `properties` is added as a dep so the memo invalidates whenever properties change — forcing a re-read of `table.getAllLeafColumns()` which by then reflects the renamed metadata.

Also destructure `properties` in the function signature.

- [ ] **Step 3: Build**

Expected to fail until the toolbar passes `properties`.

---

## Task 6: `BaseToolbar` — pass `base.properties` to `ViewFieldVisibility`

**Files:**
- Modify: `apps/client/src/features/base/components/base-toolbar.tsx`

- [ ] **Step 1: Pass the prop**

Find `<ViewFieldVisibility ... />` (near the bottom of the file). Add:
```tsx
<ViewFieldVisibility
  opened={fieldsOpened}
  onClose={() => setFieldsOpened(false)}
  table={table}
  properties={base.properties}
  onPersist={onPersistViewConfig}
>
```

`base` is already a prop on `BaseToolbar` — no other plumbing needed.

- [ ] **Step 2: Build**

```bash
pnpm nx run client:build
```

Should succeed.

- [ ] **Step 3: Commit the popover-side changes**

```bash
git add \
  apps/client/src/features/base/components/views/view-field-visibility.tsx \
  apps/client/src/features/base/components/base-toolbar.tsx
git commit -m "fix(base): refresh hide-fields popover when a property is renamed"
```

---

## Task 7: USER smoke test

> ⚠️ **Do not run `pnpm dev` as an agent.** Hand off to the user.

Ask the user to run through:

- [ ] **Local rename updates the grid header instantly.**
  1. Open a base.
  2. Click a column header → Rename → type a new name → press Enter.
  3. The column header text updates immediately — no reload.

- [ ] **Local rename updates the hide-fields popover instantly.**
  1. After renaming, open the Hide fields popover.
  2. The property's entry in the list shows the new name.

- [ ] **Remote rename (other client) updates without reload.**
  1. Open the same base in two browsers / tabs (A and B).
  2. In A, rename a property.
  3. In B, within a second, the header text (and hide-fields popover) show the new name.

- [ ] **Regression: column resize, reorder, hide, sort, filter all still work.**

If all pass, the fix is complete. Otherwise report back with which case failed.

---

## Out of scope

- `ViewSortConfigPopover` / `ViewFilterConfigPopover` also show property names, but they read from `base.properties` directly (they already get `base` as a prop and re-render when it changes), so they weren't broken by this bug. Not touching them.
- Property icons (`property.type` change). A type change already bumps `schemaVersion` on the base, which invalidates and refetches — that path works. Out of scope here.
- Server-side — rename already persists + broadcasts correctly.
