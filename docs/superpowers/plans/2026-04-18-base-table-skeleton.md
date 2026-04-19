# Base Table Skeleton Loading State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the centered Mantine `<Loader>` that currently renders while a base is loading with a layout-matching skeleton of the toolbar + grid built from Mantine `<Skeleton>` shimmers, so there is no layout shift when real data lands.

**Architecture:** A new self-contained component that renders the same DOM skeleton as the real table (toolbar row + header row + N body rows) using Mantine's `Skeleton` primitive, styled with the existing grid CSS module so tracks and heights match 1:1. `BaseTable` swaps its loading branch from `<Loader>` to `<BaseTableSkeleton />`.

**Tech Stack:** React 18, Mantine v8 `Skeleton`, existing CSS module (`grid.module.css`).

---

## Background

Current loading branch in [`base-table.tsx:157-163`](apps/client/src/features/base/components/base-table.tsx:157):

```tsx
if (baseLoading || rowsLoading) {
  return (
    <div className={classes.loadingOverlay}>
      <Loader size="md" />
    </div>
  );
}
```

`.loadingOverlay` ([`grid.module.css:290-295`](apps/client/src/features/base/styles/grid.module.css:290)) is a centered flex container. Only used here.

Real table structure (for reference so the skeleton matches):

- **Toolbar row** — view tabs on the left (each is a ~32px-wide pill), four `ActionIcon`s on the right (16px icons).
- **Header row** — subgrid. Pinned row-number column (64px). Primary column pinned. Each header cell is 34px tall, has a 14px type icon, and a short property-name label.
- **Body rows** — subgrid, 36px min-height, cells separated by 1px borders.

Matching the real layout 1:1 means:
- Same `display: grid` + `grid-template-columns` on the outer container.
- Same `.headerRow` / `.row` / `.cell` classes from `grid.module.css` so padding, borders, and heights line up.
- When the real data lands, the only visual change is `<Skeleton>` → real content — no reflow, no column-width jump.

**Skeleton dimensions (tuned for a neutral default, since we don't yet know the view's column widths):**

- 6 columns, 180px each (matches `DEFAULT_COLUMN_WIDTH` in [`use-base-table.ts:25`](apps/client/src/features/base/hooks/use-base-table.ts:25)).
- Row-number column: 64px (matches `ROW_NUMBER_COLUMN_WIDTH`).
- 10 body rows.
- Toolbar: 3 view tab pills (44px each), 4 action icons (22px each).

Varying the per-cell skeleton width within each column (between ~50% and ~85% of the cell width) adds realism — otherwise every cell skeleton is identical and screams "fake".

---

## File Structure

**New files:**
- `apps/client/src/features/base/components/base-table-skeleton.tsx` — the skeleton component.
- `apps/client/src/features/base/styles/base-table-skeleton.module.css` — minimal additional styles (the skeleton cell wrapper needs width-constrained `<Skeleton>` children that center vertically in the 36px cell).

**Modified files:**
- `apps/client/src/features/base/components/base-table.tsx` — swap the loading branch to render `<BaseTableSkeleton />`; drop the now-unused `Loader` import.
- `apps/client/src/features/base/styles/grid.module.css` — remove `.loadingOverlay` (dead).

No new deps — `Skeleton` is already exported from `@mantine/core`.

---

## Task 1: Build the skeleton component

**Files:**
- Create: `apps/client/src/features/base/components/base-table-skeleton.tsx`
- Create: `apps/client/src/features/base/styles/base-table-skeleton.module.css`

- [ ] **Step 1: Create the CSS module**

`apps/client/src/features/base/styles/base-table-skeleton.module.css`:

```css
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--mantine-spacing-xs);
  padding: var(--mantine-spacing-xs) 0;
  margin-bottom: var(--mantine-spacing-xs);
}

.toolbarTabs {
  display: flex;
  gap: 6px;
  flex: 1;
}

.toolbarActions {
  display: flex;
  gap: var(--mantine-spacing-xs);
  margin-left: auto;
}

.gridWrapper {
  overflow: hidden;
  flex: 1;
  border-top: 1px solid
    light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4));
}

.grid {
  display: grid;
}

.cellInner {
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: 0 8px;
}

.headerCellInner {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  width: 100%;
  padding: 0 8px;
}
```

- [ ] **Step 2: Create the skeleton component**

`apps/client/src/features/base/components/base-table-skeleton.tsx`:

```tsx
import { Skeleton } from "@mantine/core";
import gridClasses from "@/features/base/styles/grid.module.css";
import classes from "@/features/base/styles/base-table-skeleton.module.css";

const ROW_NUMBER_WIDTH = 64;
const COLUMN_WIDTH = 180;
const COLUMN_COUNT = 6;
const ROW_COUNT = 10;

// Pseudo-random but deterministic widths so the skeleton doesn't flicker
// between renders. Values are a rough normal distribution around
// 60-85 % of the cell width.
const CELL_WIDTH_RATIOS = [0.78, 0.62, 0.84, 0.55, 0.71, 0.66];
const HEADER_WIDTH_RATIOS = [0.42, 0.58, 0.5, 0.64, 0.46, 0.54];

export function BaseTableSkeleton() {
  const gridTemplateColumns = [
    `${ROW_NUMBER_WIDTH}px`,
    ...Array.from({ length: COLUMN_COUNT }, () => `${COLUMN_WIDTH}px`),
  ].join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className={classes.toolbar}>
        <div className={classes.toolbarTabs}>
          <Skeleton height={22} width={44} radius="sm" />
          <Skeleton height={22} width={64} radius="sm" />
          <Skeleton height={22} width={48} radius="sm" />
        </div>
        <div className={classes.toolbarActions}>
          <Skeleton height={22} width={22} circle />
          <Skeleton height={22} width={22} circle />
          <Skeleton height={22} width={22} circle />
          <Skeleton height={22} width={22} circle />
        </div>
      </div>

      <div className={classes.gridWrapper}>
        <div className={classes.grid} style={{ gridTemplateColumns }}>
          {/* Header row */}
          <div className={gridClasses.headerCell}>
            <div className={classes.headerCellInner}>
              <Skeleton height={14} width={14} circle />
            </div>
          </div>
          {Array.from({ length: COLUMN_COUNT }).map((_, colIndex) => (
            <div key={`h-${colIndex}`} className={gridClasses.headerCell}>
              <div className={classes.headerCellInner}>
                <Skeleton height={14} width={14} circle />
                <Skeleton
                  height={10}
                  width={`${HEADER_WIDTH_RATIOS[colIndex] * 100}%`}
                  radius="sm"
                />
              </div>
            </div>
          ))}

          {/* Body rows */}
          {Array.from({ length: ROW_COUNT }).map((_, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              style={{ display: "contents" }}
            >
              <div className={gridClasses.cell}>
                <div className={classes.cellInner}>
                  <Skeleton height={10} width={18} radius="sm" />
                </div>
              </div>
              {Array.from({ length: COLUMN_COUNT }).map((_, colIndex) => (
                <div
                  key={`cell-${rowIndex}-${colIndex}`}
                  className={gridClasses.cell}
                >
                  <div className={classes.cellInner}>
                    <Skeleton
                      height={10}
                      width={`${CELL_WIDTH_RATIOS[(rowIndex + colIndex) % CELL_WIDTH_RATIOS.length] * 100}%`}
                      radius="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Key points the implementer must not change:
- `gridClasses.headerCell` and `gridClasses.cell` come from the REAL table's CSS module so borders, heights, and hover semantics match exactly. Don't reinvent them.
- The `style={{ display: "contents" }}` row wrapper is intentional — the outer `.grid` is a single CSS grid, and each "row" is just a flattened sequence of cells that span the grid columns via `display: contents`. This mirrors how the real table flattens rows (see `.row` with `grid-column: 1 / -1; grid-template-columns: subgrid;` in [`grid.module.css:119-123`](apps/client/src/features/base/styles/grid.module.css:119)). We use `contents` instead of subgrid because the skeleton's outer grid is not a subgrid.
- Using `Skeleton` with `circle` prop for the row-number placeholder and type-icon placeholders — these match the real UI's round/small icon presence.
- The `CELL_WIDTH_RATIOS[(rowIndex + colIndex) % ...]` gives each cell a deterministic-but-varied skeleton width so it doesn't look like a stamped pattern.

- [ ] **Step 3: Build to verify TypeScript compiles**

```bash
pnpm nx run client:build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add \
  apps/client/src/features/base/components/base-table-skeleton.tsx \
  apps/client/src/features/base/styles/base-table-skeleton.module.css
git commit -m "feat(base): add layout-matching skeleton loading component"
```

---

## Task 2: Swap the loader for the skeleton in BaseTable

**Files:**
- Modify: `apps/client/src/features/base/components/base-table.tsx`
- Modify: `apps/client/src/features/base/styles/grid.module.css`

- [ ] **Step 1: Replace the loading branch**

In `base-table.tsx`:

Drop `Loader` from the `@mantine/core` import (line 2). Leave `Text` and `Stack` — they're still used by the error branch.

Add near the other imports:
```tsx
import { BaseTableSkeleton } from "@/features/base/components/base-table-skeleton";
```

Change lines 157-163:

Before:
```tsx
if (baseLoading || rowsLoading) {
  return (
    <div className={classes.loadingOverlay}>
      <Loader size="md" />
    </div>
  );
}
```

After:
```tsx
if (baseLoading || rowsLoading) {
  return <BaseTableSkeleton />;
}
```

- [ ] **Step 2: Remove the dead `.loadingOverlay` class**

In `apps/client/src/features/base/styles/grid.module.css`, delete lines 290-295 (the `.loadingOverlay { ... }` block — exact content):

```css
.loadingOverlay {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--mantine-spacing-xl);
}
```

- [ ] **Step 3: Build**

```bash
pnpm nx run client:build
```

Expected: success with no "unused" warnings from the removed class.

- [ ] **Step 4: Commit**

```bash
git add \
  apps/client/src/features/base/components/base-table.tsx \
  apps/client/src/features/base/styles/grid.module.css
git commit -m "feat(base): show table skeleton instead of centered loader on load"
```

---

## Task 3: USER smoke test

> ⚠️ **Do not run `pnpm dev` as an agent.** Hand off.

Ask the user to:

- [ ] **Fresh load.** Open a base fresh (full tab reload). The skeleton should render immediately, then transition cleanly to the real table. No jarring jump, no centered spinner.

- [ ] **Throttled load.** DevTools → Network tab → throttle to "Slow 3G" → reload. The skeleton should stay visible for the duration of the slow request, shimmer visible the whole time.

- [ ] **Dark mode.** Toggle to dark mode. Skeleton colors should render appropriately (Mantine's `Skeleton` handles this automatically via light-dark tokens).

- [ ] **Window resize during load.** Resize the browser window while the skeleton is showing. Skeleton's CSS grid should stretch the columns proportionally — no layout break.

- [ ] **Error state still works.** Hard to trigger; if you can, disable network entirely and reload. You should see the existing "Failed to load base" message, NOT the skeleton stuck forever.

- [ ] **No console errors / CSS warnings during transition from skeleton → real table.**

If all pass, the swap is done.

---

## Out of scope

- Matching the exact column count and widths the view ends up rendering. The skeleton is a neutral placeholder; a perfect match would require knowing the view config, which we don't have before the base query resolves. A 6-column, 180px default is "close enough to not flash".
- Skeleton for `GridContainer` inside an already-loaded base (e.g., when switching views of the same base, where we already have properties). Out of scope — this plan only addresses the initial load path.
- Progressive hydration (render the toolbar first, then skeleton rows as they stream in). Overkill for a small base query.
