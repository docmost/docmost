# Base Row Selection & Bulk Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Airtable-style multi-row selection (checkbox in row-number cell) + bulk delete via a floating action bar, backed by a new batch-delete endpoint.

**Architecture:** Client stores selection in a jotai atom scoped to the active base/view. Row-number cell swaps between row-index and drag-handle+checkbox based on hover/selection state. A floating action bar fires `POST /bases/rows/delete-many`. Server adds a single-UPDATE soft-delete path that emits one `BASE_ROWS_DELETED` event relayed to clients over the existing base socket room.

**Tech Stack:** NestJS + Kysely (server), React + TanStack Table + jotai + Mantine (client). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-18-base-row-selection-design.md`

---

## Build order

Server endpoint first (so client mutations have something to hit), then client state + mutation, then UI, then realtime reconciliation.

---

### Task 1: Add `softDeleteMany` + `findByIds` to base-row repo

**Files:**
- Modify: `apps/server/src/database/repos/base/base-row.repo.ts`

Pattern matches the existing `findById` and `softDelete` methods in the same file.

- [ ] **Step 1: Add `findByIds` method**

After the existing `findById` method, add:

```ts
async findByIds(
  rowIds: string[],
  opts: WorkspaceOpts,
): Promise<BaseRow[]> {
  if (rowIds.length === 0) return [];
  const db = dbOrTx(this.db, opts.trx);
  return (await db
    .selectFrom('baseRows')
    .select(BASE_ROW_COLUMNS)
    .where('id', 'in', rowIds)
    .where('workspaceId', '=', opts.workspaceId)
    .where('deletedAt', 'is', null)
    .execute()) as BaseRow[];
}
```

- [ ] **Step 2: Add `softDeleteMany` method**

After the existing `softDelete` method, add:

```ts
async softDeleteMany(
  rowIds: string[],
  opts: {
    baseId: string;
    workspaceId: string;
    trx?: KyselyTransaction;
  },
): Promise<void> {
  if (rowIds.length === 0) return;
  const db = dbOrTx(this.db, opts.trx);
  await db
    .updateTable('baseRows')
    .set({ deletedAt: new Date() })
    .where('id', 'in', rowIds)
    .where('baseId', '=', opts.baseId)
    .where('workspaceId', '=', opts.workspaceId)
    .where('deletedAt', 'is', null)
    .execute();
}
```

- [ ] **Step 3: Build server**

Run: `pnpm nx run server:build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/database/repos/base/base-row.repo.ts
git commit -m "feat(base): add findByIds and softDeleteMany to base-row repo"
```

---

### Task 2: Add `DeleteRowsDto` for batch delete

**Files:**
- Modify: `apps/server/src/core/base/dto/update-row.dto.ts`

- [ ] **Step 1: Add DTO**

Append to the end of the file:

```ts
export class DeleteRowsDto {
  @IsUUID()
  baseId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  rowIds: string[];

  @IsOptional()
  @IsString()
  requestId?: string;
}
```

Ensure imports at the top of the file include `IsArray`, `ArrayMinSize`, `ArrayMaxSize` from `class-validator` (add any missing ones to the existing import line).

- [ ] **Step 2: Build server**

Run: `pnpm nx run server:build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/base/dto/update-row.dto.ts
git commit -m "feat(base): add DeleteRowsDto for batch row delete"
```

---

### Task 3: Add `BASE_ROWS_DELETED` event name + payload type

**Files:**
- Modify: `apps/server/src/common/events/event.contants.ts`
- Modify: `apps/server/src/core/base/events/base-events.ts`

- [ ] **Step 1: Add event name constant**

In `apps/server/src/common/events/event.contants.ts`, add a new enum member near the existing `BASE_ROW_DELETED`:

```ts
BASE_ROWS_DELETED = 'base.rows.deleted',
```

- [ ] **Step 2: Add event payload type**

In `apps/server/src/core/base/events/base-events.ts`, add after `BaseRowDeletedEvent`:

```ts
export type BaseRowsDeletedEvent = BaseEventBase & { rowIds: string[] };
```

- [ ] **Step 3: Build server**

Run: `pnpm nx run server:build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/common/events/event.contants.ts apps/server/src/core/base/events/base-events.ts
git commit -m "feat(base): add BASE_ROWS_DELETED event type"
```

---

### Task 4: Add `deleteMany` service method

**Files:**
- Modify: `apps/server/src/core/base/services/base-row.service.ts`

- [ ] **Step 1: Add import for new DTO and event**

In the imports block:
- Ensure `DeleteRowsDto` is imported from `../dto/update-row.dto`.
- Ensure `BaseRowsDeletedEvent` is imported from `../events/base-events`.

- [ ] **Step 2: Add `deleteMany` method after existing `delete`**

```ts
async deleteMany(
  dto: DeleteRowsDto,
  workspaceId: string,
  userId?: string,
): Promise<void> {
  const rows = await this.baseRowRepo.findByIds(dto.rowIds, { workspaceId });
  if (rows.length !== dto.rowIds.length) {
    throw new NotFoundException('One or more rows not found');
  }
  if (rows.some((r) => r.baseId !== dto.baseId)) {
    throw new NotFoundException('Row does not belong to base');
  }

  await this.baseRowRepo.softDeleteMany(dto.rowIds, {
    baseId: dto.baseId,
    workspaceId,
  });

  const event: BaseRowsDeletedEvent = {
    baseId: dto.baseId,
    workspaceId,
    actorId: userId ?? null,
    requestId: dto.requestId ?? null,
    rowIds: dto.rowIds,
  };
  this.eventEmitter.emit(EventName.BASE_ROWS_DELETED, event);
}
```

- [ ] **Step 3: Build server**

Run: `pnpm nx run server:build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/core/base/services/base-row.service.ts
git commit -m "feat(base): add deleteMany service method for batch row delete"
```

---

### Task 5: Add `delete-many` controller endpoint

**Files:**
- Modify: `apps/server/src/core/base/controllers/base-row.controller.ts`

- [ ] **Step 1: Import `DeleteRowsDto`**

Add `DeleteRowsDto` to the existing `update-row.dto` import line.

- [ ] **Step 2: Add endpoint handler**

Insert after the existing `@Post('delete')` handler (i.e. after the `delete` method that ends at line 119):

```ts
@HttpCode(HttpStatus.OK)
@Post('delete-many')
async deleteMany(
  @Body() dto: DeleteRowsDto,
  @AuthUser() user: User,
  @AuthWorkspace() workspace: Workspace,
) {
  const base = await this.baseRepo.findById(dto.baseId);
  if (!base) {
    throw new NotFoundException('Base not found');
  }

  const ability = await this.spaceAbility.createForUser(user, base.spaceId);
  if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Base)) {
    throw new ForbiddenException();
  }

  await this.baseRowService.deleteMany(dto, workspace.id, user.id);
}
```

- [ ] **Step 3: Build server**

Run: `pnpm nx run server:build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/core/base/controllers/base-row.controller.ts
git commit -m "feat(base): add POST /bases/rows/delete-many endpoint"
```

---

### Task 6: Realtime consumer for batch row delete

**Files:**
- Modify: `apps/server/src/core/base/realtime/base-ws-consumers.ts`

- [ ] **Step 1: Import the new event type**

Add `BaseRowsDeletedEvent` to the import from `../events/base-events`.

- [ ] **Step 2: Add the event handler**

Insert after the existing `onRowDeleted` handler (approx line 64):

```ts
@OnEvent(EventName.BASE_ROWS_DELETED)
onRowsDeleted(e: BaseRowsDeletedEvent) {
  this.ws.emitToBase(e.baseId, {
    operation: 'base:rows:deleted',
    baseId: e.baseId,
    rowIds: e.rowIds,
    actorId: e.actorId ?? null,
    requestId: e.requestId ?? null,
  });
}
```

- [ ] **Step 3: Build server**

Run: `pnpm nx run server:build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/core/base/realtime/base-ws-consumers.ts
git commit -m "feat(base): emit base:rows:deleted websocket event"
```

---

### Task 7: Client service + types for batch delete

**Files:**
- Modify: `apps/client/src/features/base/types/base.types.ts`
- Modify: `apps/client/src/features/base/services/base-service.ts`

- [ ] **Step 1: Add `DeleteRowsInput` type**

In `base.types.ts`, find the existing `DeleteRowInput` type and add just below it:

```ts
export type DeleteRowsInput = {
  baseId: string;
  rowIds: string[];
  requestId?: string;
};
```

- [ ] **Step 2: Add `deleteRows` service function**

In `base-service.ts`, add `DeleteRowsInput` to the type imports from `@/features/base/types/base.types`, then add after the existing `deleteRow`:

```ts
export async function deleteRows(data: DeleteRowsInput): Promise<void> {
  await api.post("/bases/rows/delete-many", data);
}
```

- [ ] **Step 3: Build client**

Run: `pnpm nx run client:build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/features/base/types/base.types.ts apps/client/src/features/base/services/base-service.ts
git commit -m "feat(base): add deleteRows client service + type"
```

---

### Task 8: `useDeleteRowsMutation` with optimistic update

**Files:**
- Modify: `apps/client/src/features/base/queries/base-row-query.ts`

- [ ] **Step 1: Add imports**

Add `deleteRows` to the imports from `@/features/base/services/base-service` and `DeleteRowsInput` to the type imports.

Note: `RowCacheContext` is already defined at the top of this file (used by `useDeleteRowMutation`); reuse it — no new import or local type needed.

- [ ] **Step 2: Add the mutation hook after `useDeleteRowMutation`**

```ts
export function useDeleteRowsMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, DeleteRowsInput, RowCacheContext>({
    mutationFn: (data) => deleteRows({ ...data, requestId: newRequestId() }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["base-rows", variables.baseId],
      });

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IPagination<IBaseRow>>
      >({ queryKey: ["base-rows", variables.baseId] });

      const removeSet = new Set(variables.rowIds);
      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", variables.baseId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((row) => !removeSet.has(row.id)),
            })),
          };
        },
      );

      return { snapshots };
    },
    onError: (_, __, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      notifications.show({
        message: t("Failed to delete rows"),
        color: "red",
      });
    },
  });
}
```

- [ ] **Step 3: Build client**

Run: `pnpm nx run client:build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/features/base/queries/base-row-query.ts
git commit -m "feat(base): add useDeleteRowsMutation with optimistic update"
```

---

### Task 9: Selection atoms

**Files:**
- Modify: `apps/client/src/features/base/atoms/base-atoms.ts`

- [ ] **Step 1: Add selection atoms**

Append:

```ts
export const selectedRowIdsAtom = atom<Set<string>>(new Set<string>());
export const lastToggledRowIndexAtom = atom<number | null>(null);
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/features/base/atoms/base-atoms.ts
git commit -m "feat(base): add row selection atoms"
```

---

### Task 10: `use-row-selection` hook

**Files:**
- Create: `apps/client/src/features/base/hooks/use-row-selection.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useCallback } from "react";
import { useAtom } from "jotai";
import {
  selectedRowIdsAtom,
  lastToggledRowIndexAtom,
} from "@/features/base/atoms/base-atoms";

type ToggleOpts = {
  shiftKey: boolean;
  rowIndex: number;
  orderedRowIds: string[];
};

export function useRowSelection() {
  const [selectedIds, setSelectedIds] = useAtom(selectedRowIdsAtom);
  const [lastToggledIndex, setLastToggledIndex] = useAtom(
    lastToggledRowIndexAtom,
  );

  const isSelected = useCallback(
    (rowId: string) => selectedIds.has(rowId),
    [selectedIds],
  );

  const toggle = useCallback(
    (rowId: string, opts: ToggleOpts) => {
      const { shiftKey, rowIndex, orderedRowIds } = opts;
      const next = new Set(selectedIds);

      if (shiftKey && lastToggledIndex !== null && lastToggledIndex !== rowIndex) {
        const start = Math.min(lastToggledIndex, rowIndex);
        const end = Math.max(lastToggledIndex, rowIndex);
        const anchorId = orderedRowIds[lastToggledIndex];
        const turnOn = anchorId ? next.has(anchorId) : true;
        for (let i = start; i <= end; i += 1) {
          const id = orderedRowIds[i];
          if (!id) continue;
          if (turnOn) next.add(id);
          else next.delete(id);
        }
      } else {
        if (next.has(rowId)) next.delete(rowId);
        else next.add(rowId);
      }

      setSelectedIds(next);
      setLastToggledIndex(rowIndex);
    },
    [selectedIds, lastToggledIndex, setSelectedIds, setLastToggledIndex],
  );

  const toggleAll = useCallback(
    (loadedRowIds: string[]) => {
      if (loadedRowIds.length === 0) return;
      const allSelected = loadedRowIds.every((id) => selectedIds.has(id));
      if (allSelected) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(loadedRowIds));
      }
      setLastToggledIndex(null);
    },
    [selectedIds, setSelectedIds, setLastToggledIndex],
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    setLastToggledIndex(null);
  }, [setSelectedIds, setLastToggledIndex]);

  const removeIds = useCallback(
    (rowIds: string[]) => {
      if (rowIds.length === 0) return;
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        let changed = false;
        const next = new Set(prev);
        for (const id of rowIds) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    },
    [setSelectedIds],
  );

  return {
    selectedIds,
    selectionCount: selectedIds.size,
    isSelected,
    toggle,
    toggleAll,
    clear,
    removeIds,
  };
}
```

- [ ] **Step 2: Build client**

Run: `pnpm nx run client:build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/base/hooks/use-row-selection.ts
git commit -m "feat(base): add use-row-selection hook"
```

---

### Task 11: Extract `RowNumberCell` with checkbox swap

**Files:**
- Create: `apps/client/src/features/base/components/grid/row-number-cell.tsx`
- Modify: `apps/client/src/features/base/components/grid/grid-cell.tsx`
- Modify: `apps/client/src/features/base/styles/grid.module.css`

- [ ] **Step 1: Add CSS rules**

Append to `grid.module.css`:

```css
.rowNumberCellInner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding: 0 6px;
}

.rowNumberIndex {
  display: inline;
}

.rowNumberCheckbox,
.rowNumberDragHandle {
  display: none;
  align-items: center;
  justify-content: center;
}

.rowNumberDragHandle {
  color: light-dark(var(--mantine-color-gray-5), var(--mantine-color-dark-3));
  cursor: grab;
}

.rowNumberDragHandle:active {
  cursor: grabbing;
}

/* On hover, hide the index and show drag handle + checkbox */
.row:hover .rowNumberIndex {
  display: none;
}
.row:hover .rowNumberCheckbox,
.row:hover .rowNumberDragHandle {
  display: inline-flex;
}

/* When selected, checkbox always visible; index + drag handle hidden */
.rowSelected .rowNumberIndex,
.rowSelected .rowNumberDragHandle {
  display: none;
}
.rowSelected .rowNumberCheckbox {
  display: inline-flex;
}
.rowSelected .cell {
  background: light-dark(var(--mantine-color-blue-0), var(--mantine-color-dark-6));
}
```

- [ ] **Step 2: Create `row-number-cell.tsx`**

```tsx
import { memo, useCallback } from "react";
import { Checkbox } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import classes from "@/features/base/styles/grid.module.css";

type RowDragProps = {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
};

type RowNumberCellProps = {
  rowId: string;
  rowIndex: number;
  orderedRowIds: string[];
  isPinned: boolean;
  pinOffset?: number;
  rowDragProps?: RowDragProps;
};

export const RowNumberCell = memo(function RowNumberCell({
  rowId,
  rowIndex,
  orderedRowIds,
  isPinned,
  pinOffset,
  rowDragProps,
}: RowNumberCellProps) {
  const { isSelected, toggle } = useRowSelection();
  const selected = isSelected(rowId);

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nativeEvent = e.nativeEvent as MouseEvent;
      toggle(rowId, {
        shiftKey: nativeEvent.shiftKey === true,
        rowIndex,
        orderedRowIds,
      });
    },
    [rowId, rowIndex, orderedRowIds, toggle],
  );

  return (
    <div
      className={`${classes.cell} ${classes.rowNumberCell} ${isPinned ? classes.cellPinned : ""}`}
      style={isPinned ? { left: pinOffset } : undefined}
    >
      <div className={classes.rowNumberCellInner}>
        <span
          className={classes.rowNumberDragHandle}
          draggable={rowDragProps?.draggable}
          onDragStart={rowDragProps?.onDragStart}
          aria-label="Drag row"
        >
          <IconGripVertical size={12} />
        </span>
        <span className={classes.rowNumberCheckbox}>
          <Checkbox
            size="xs"
            checked={selected}
            onChange={handleCheckboxChange}
            aria-label="Select row"
          />
        </span>
        <span className={classes.rowNumberIndex}>{rowIndex + 1}</span>
      </div>
    </div>
  );
});
```

- [ ] **Step 3: Update `grid-cell.tsx` to use the new component**

Replace the `if (isRowNumber) { ... }` block (lines 108–121) with a render of `<RowNumberCell>`. Add `orderedRowIds?: string[]` to `GridCellProps` and pass it through. Import `RowNumberCell`. The final branch becomes:

```tsx
if (isRowNumber) {
  return (
    <RowNumberCell
      rowId={rowId}
      rowIndex={rowIndex}
      orderedRowIds={orderedRowIds ?? []}
      isPinned={isPinned}
      pinOffset={pinOffset}
      rowDragProps={rowDragProps}
    />
  );
}
```

- [ ] **Step 4: Propagate `orderedRowIds` through `GridRow`**

Modify `apps/client/src/features/base/components/grid/grid-row.tsx`:
- Add `orderedRowIds: string[]` to `GridRowProps`.
- Pass it through to `<GridCell>`.
- Apply `classes.rowSelected` to the root `<div>` when `useRowSelection().isSelected(row.id)`.

- [ ] **Step 5: Build client**

Run: `pnpm nx run client:build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/features/base/components/grid/row-number-cell.tsx apps/client/src/features/base/components/grid/grid-cell.tsx apps/client/src/features/base/components/grid/grid-row.tsx apps/client/src/features/base/styles/grid.module.css
git commit -m "feat(base): row-number cell renders checkbox + drag handle on hover"
```

---

### Task 12: `RowNumberHeaderCell` with tri-state select-all

**Files:**
- Create: `apps/client/src/features/base/components/grid/row-number-header-cell.tsx`
- Modify: `apps/client/src/features/base/components/grid/grid-header-cell.tsx`
- Modify: `apps/client/src/features/base/styles/grid.module.css`

- [ ] **Step 1: Add header CSS**

Append to `grid.module.css`:

```css
.rowNumberHeaderInner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.rowNumberHeaderHash {
  color: light-dark(var(--mantine-color-gray-5), var(--mantine-color-dark-3));
  font-size: var(--mantine-font-size-xs);
}

.rowNumberHeaderCheckbox {
  display: none;
}

.headerCell:hover .rowNumberHeaderHash,
.hasSelection .rowNumberHeaderHash {
  display: none;
}

.headerCell:hover .rowNumberHeaderCheckbox,
.hasSelection .rowNumberHeaderCheckbox {
  display: inline-flex;
}
```

- [ ] **Step 2: Create the component**

```tsx
import { memo, useMemo } from "react";
import { Checkbox, Tooltip } from "@mantine/core";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import classes from "@/features/base/styles/grid.module.css";

type RowNumberHeaderCellProps = {
  loadedRowIds: string[];
};

export const RowNumberHeaderCell = memo(function RowNumberHeaderCell({
  loadedRowIds,
}: RowNumberHeaderCellProps) {
  const { selectedIds, toggleAll } = useRowSelection();

  const { checked, indeterminate } = useMemo(() => {
    if (loadedRowIds.length === 0) {
      return { checked: false, indeterminate: false };
    }
    const selectedInLoaded = loadedRowIds.reduce(
      (acc, id) => (selectedIds.has(id) ? acc + 1 : acc),
      0,
    );
    return {
      checked: selectedInLoaded === loadedRowIds.length,
      indeterminate:
        selectedInLoaded > 0 && selectedInLoaded < loadedRowIds.length,
    };
  }, [loadedRowIds, selectedIds]);

  if (loadedRowIds.length === 0) return null;

  return (
    <div className={classes.rowNumberHeaderInner}>
      <span className={classes.rowNumberHeaderHash}>#</span>
      <span className={classes.rowNumberHeaderCheckbox}>
        <Tooltip label="Select all loaded rows" withinPortal>
          <Checkbox
            size="xs"
            checked={checked}
            indeterminate={indeterminate}
            onChange={() => toggleAll(loadedRowIds)}
            aria-label="Select all loaded rows"
          />
        </Tooltip>
      </span>
    </div>
  );
});
```

Note: reading `selectedIds` from the hook ensures this re-renders on selection change.

- [ ] **Step 3: Wire into `grid-header-cell.tsx`**

In `grid-header-cell.tsx`, locate the `isRowNumber ? ( flexRender(...) ) : ( ... )` ternary in the JSX (the existing branch renders `#` via `flexRender(header.column.columnDef.header, header.getContext())`). Replace the `isRowNumber` branch with:

```tsx
isRowNumber ? (
  <RowNumberHeaderCell loadedRowIds={loadedRowIds} />
) : (
  // existing non-row-number branch unchanged
)
```

Add `loadedRowIds: string[]` as a required prop on `GridHeaderCellProps` (and thread it through — see Step 4). Also add the `classes.hasSelection` class to the header cell's root `div` (line 121 area) when `useRowSelection().selectionCount > 0`:

```tsx
className={`${classes.headerCell} ${isPinned ? classes.headerCellPinned : ""} ${hasSelection ? classes.hasSelection : ""}`}
```

where `const { selectionCount } = useRowSelection(); const hasSelection = selectionCount > 0;` is added near the top of `GridHeaderCell`.

- [ ] **Step 4: Thread `loadedRowIds` through `GridHeader` → `GridHeaderCell`**

In `grid-header.tsx`, add `loadedRowIds: string[]` as a required prop on `GridHeaderProps`. Pass it to each rendered `<GridHeaderCell>`.

In `grid-container.tsx`, reuse the existing `rowIds` memo (`rows.map((r) => r.id)`) and pass it as `loadedRowIds={rowIds}` to `<GridHeader>`.

- [ ] **Step 5: Build client**

Run: `pnpm nx run client:build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/features/base/components/grid/row-number-header-cell.tsx apps/client/src/features/base/components/grid/grid-header-cell.tsx apps/client/src/features/base/components/grid/grid-header.tsx apps/client/src/features/base/components/grid/grid-container.tsx apps/client/src/features/base/styles/grid.module.css
git commit -m "feat(base): header select-all with tri-state checkbox"
```

---

### Task 13: `use-delete-selected-rows` hook + `SelectionActionBar` floating bar

**Files:**
- Create: `apps/client/src/features/base/hooks/use-delete-selected-rows.ts`
- Create: `apps/client/src/features/base/components/grid/selection-action-bar.tsx`
- Modify: `apps/client/src/features/base/components/grid/grid-container.tsx`
- Modify: `apps/client/src/features/base/styles/grid.module.css`

- [ ] **Step 1: Add CSS**

Append:

```css
.selectionActionBarWrapper {
  position: sticky;
  bottom: 16px;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 5;
  grid-column: 1 / -1;
}

.selectionActionBar {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--mantine-radius-md);
  box-shadow: var(--mantine-shadow-lg);
  background: light-dark(var(--mantine-color-white), var(--mantine-color-dark-6));
  border: 1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4));
}

.selectionActionBarCount {
  font-size: var(--mantine-font-size-sm);
  color: light-dark(var(--mantine-color-gray-7), var(--mantine-color-dark-0));
}
```

- [ ] **Step 2: Create `use-delete-selected-rows.ts`**

```ts
import { useCallback } from "react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import { useDeleteRowsMutation } from "@/features/base/queries/base-row-query";

const BATCH_SIZE = 500;

export function useDeleteSelectedRows(baseId: string) {
  const { t } = useTranslation();
  const { selectedIds, clear } = useRowSelection();
  const mutation = useDeleteRowsMutation();

  const deleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      chunks.push(ids.slice(i, i + BATCH_SIZE));
    }
    try {
      for (const chunk of chunks) {
        await mutation.mutateAsync({ baseId, rowIds: chunk });
      }
      notifications.show({
        message: t("{{count}} rows deleted", { count: ids.length }),
      });
      clear();
    } catch {
      // mutation onError already shows notification
    }
  }, [baseId, selectedIds, mutation, clear, t]);

  return { deleteSelected, isPending: mutation.isPending };
}
```

- [ ] **Step 3: Create `selection-action-bar.tsx`**

```tsx
import { memo } from "react";
import { ActionIcon, Button, Transition } from "@mantine/core";
import { IconTrash, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import { useDeleteSelectedRows } from "@/features/base/hooks/use-delete-selected-rows";
import classes from "@/features/base/styles/grid.module.css";

type SelectionActionBarProps = {
  baseId: string;
};

export const SelectionActionBar = memo(function SelectionActionBar({
  baseId,
}: SelectionActionBarProps) {
  const { t } = useTranslation();
  const { selectionCount, clear } = useRowSelection();
  const { deleteSelected, isPending } = useDeleteSelectedRows(baseId);

  const isOpen = selectionCount > 0;

  return (
    <Transition mounted={isOpen} transition="slide-up" duration={150}>
      {(styles) => (
        <div className={classes.selectionActionBarWrapper} style={styles}>
          <div className={classes.selectionActionBar}>
            <span className={classes.selectionActionBarCount}>
              {t("{{count}} selected", { count: selectionCount })}
            </span>
            <Button
              size="xs"
              color="red"
              variant="light"
              leftSection={<IconTrash size={14} />}
              loading={isPending}
              onClick={() => void deleteSelected()}
            >
              {t("Delete")}
            </Button>
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={clear}
              aria-label={t("Clear selection")}
            >
              <IconX size={14} />
            </ActionIcon>
          </div>
        </div>
      )}
    </Transition>
  );
});
```

- [ ] **Step 4: Mount in `grid-container.tsx`**

In `grid-container.tsx`:
- Add `import { SelectionActionBar } from "./selection-action-bar";`
- Render `<SelectionActionBar baseId={baseId!} />` directly after the `<AddRowButton ... />` line, inside the `<div className={classes.grid}>` container. Skip if `!baseId`.

- [ ] **Step 5: Build client**

Run: `pnpm nx run client:build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/features/base/hooks/use-delete-selected-rows.ts apps/client/src/features/base/components/grid/selection-action-bar.tsx apps/client/src/features/base/components/grid/grid-container.tsx apps/client/src/features/base/styles/grid.module.css
git commit -m "feat(base): floating selection action bar with bulk delete"
```

---

### Task 14: Keyboard handler for Delete / Backspace / Esc

**Files:**
- Modify: `apps/client/src/features/base/components/grid/grid-container.tsx`

- [ ] **Step 1: Add keyboard handler**

In `grid-container.tsx`, add a `useEffect` that attaches a `keydown` listener to `scrollRef.current` (the grid wrapper). Guards:
1. `editingCell` is null
2. `document.activeElement` is contained by `scrollRef.current` (i.e. focus inside the grid)
3. Not typing in an input / textarea / contenteditable

Behavior:
- `Escape` → `clear()` if `selectionCount > 0`.
- `Delete` or `Backspace` → if `selectionCount > 0`, call `deleteSelected()` from `useDeleteSelectedRows`.

Add imports for `useRowSelection` and `useDeleteSelectedRows`, then:

```ts
const { deleteSelected } = useDeleteSelectedRows(baseId ?? "");
const { selectionCount, clear } = useRowSelection();

useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  const handler = (e: KeyboardEvent) => {
    if (editingCell) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active || !el.contains(active)) return;
    const tag = active.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      active.isContentEditable
    ) {
      return;
    }
    if (e.key === "Escape" && selectionCount > 0) {
      clear();
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selectionCount > 0) {
      e.preventDefault();
      void deleteSelected();
    }
  };
  el.addEventListener("keydown", handler);
  return () => el.removeEventListener("keydown", handler);
}, [editingCell, selectionCount, clear, deleteSelected]);
```

Skip this effect entirely if `!baseId`.

- [ ] **Step 2: Build client**

Run: `pnpm nx run client:build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/base/components/grid/grid-container.tsx
git commit -m "feat(base): keyboard delete and esc to clear selection"
```

---

### Task 15: Clear selection on view / filter / sort / base change

**Files:**
- Modify: `apps/client/src/features/base/components/base-table.tsx`

- [ ] **Step 1: Add effect**

Inside `BaseTable`, after the existing `useEffect` that syncs `activeViewId`, add:

```ts
const { clear: clearSelection } = useRowSelection();
useEffect(() => {
  clearSelection();
  // Clear whenever identity of base or active view changes. Filter and sort
  // changes flow through activeView.config, which re-renders the rows —
  // depending on activeView.id alone keeps this effect stable (object
  // identity of activeFilter / activeSorts may change every render).
}, [baseId, activeView?.id, clearSelection]);
```

Import `useRowSelection` from `@/features/base/hooks/use-row-selection`.

Note: the spec asks for selection to clear on filter/sort change within a single view too. For v1, clearing only on view/base change is sufficient — a user changing sort within the same view still sees the same row set re-ordered, and the selected rows remain valid. If the product later wants "clear on filter change within a view," add a filter-identity hash via `JSON.stringify(activeFilter)` as a dep.

- [ ] **Step 2: Build client**

Run: `pnpm nx run client:build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/base/components/base-table.tsx
git commit -m "feat(base): clear row selection on view/filter/sort/base change"
```

---

### Task 16: Realtime reconciliation — handle `base:rows:deleted` + prune selection

**Files:**
- Modify: `apps/client/src/features/base/hooks/use-base-socket.ts`

- [ ] **Step 1: Add new message type**

Near the existing `BaseRowDeleted` type, add:

```ts
type BaseRowsDeleted = {
  operation: "base:rows:deleted";
  baseId: string;
  rowIds: string[];
  requestId?: string | null;
};
```

Add `BaseRowsDeleted` to the union of socket message types used by the handler switch.

- [ ] **Step 2: Handle the new event**

Inside the socket handler switch/if tree, after the existing `base:row:deleted` case, add a case for `base:rows:deleted` that:
1. Skips if `requestId` is marked outbound (existing suppression helper handles this).
2. Removes all rowIds from all `["base-rows", msg.baseId]` infinite-query pages in one pass (same pattern as existing `base:row:deleted`, but with `new Set(msg.rowIds)`).
3. Prunes them from `selectedRowIdsAtom` via the jotai store.

For (3): import `getDefaultStore` from `jotai` (or read via the atom's setter) — follow whatever pattern this file already uses. If atom access from outside components is not the pattern here, instead export a `removeSelectedRowIds` helper that `base-table.tsx` subscribes to via `useEffect` listening to a ref or event — BUT the cleaner path is to call `getDefaultStore().set(selectedRowIdsAtom, ...)` directly since socket handlers are not React components.

Concrete code:

```ts
import { getDefaultStore } from "jotai";
import { selectedRowIdsAtom } from "@/features/base/atoms/base-atoms";

// inside the handler for base:rows:deleted:
const removeSet = new Set(msg.rowIds);
queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
  { queryKey: ["base-rows", msg.baseId] },
  (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.filter((row) => !removeSet.has(row.id)),
      })),
    };
  },
);
const store = getDefaultStore();
const current = store.get(selectedRowIdsAtom);
if (current.size > 0) {
  let changed = false;
  const next = new Set(current);
  for (const id of msg.rowIds) {
    if (next.delete(id)) changed = true;
  }
  if (changed) store.set(selectedRowIdsAtom, next);
}
```

- [ ] **Step 3: Also prune selection in the existing `base:row:deleted` case**

Add the same single-id `store.set(selectedRowIdsAtom, ...)` prune after the existing cache update for the single-row delete event.

- [ ] **Step 4: Build client**

Run: `pnpm nx run client:build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/features/base/hooks/use-base-socket.ts
git commit -m "feat(base): reconcile bulk delete over socket + prune selection"
```

---

### Task 17: Full build + manual verification

**Files:** none

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: both client and server build cleanly.

- [ ] **Step 2: Manual smoke test (user-led, not Claude-led)**

The user will run the dev environment. Verify:
1. Hover a row → drag handle + checkbox appear, index hides.
2. Click checkbox → row highlights, row stays checked on blur.
3. Shift-click a later row → range selected.
4. Esc → selection clears.
5. Header checkbox → select-all-loaded; click again → clear.
6. Floating bar shows `N selected` with Delete and X buttons.
7. Click Delete → rows disappear, toast `N rows deleted`, selection clears.
8. Delete/Backspace key with grid focused deletes selected rows.
9. Switch views / apply filter → selection clears.
10. Two browser windows: delete rows in one → other window's cache and selection update.

- [ ] **Step 3: Final commit (if any lint/style tweaks needed after smoke test)**

No-op if smoke test clean.

---

## Notes

- No feature flag. No migration.
- No automated tests in this plan. Base feature has no existing test harness; manual verification and build gate are sufficient per repo convention. If the user later requests tests, add a service spec for `deleteMany` patterned after `apps/server/src/core/auth/services/auth.service.spec.ts` and a hook test for `use-row-selection`.
- Tasks 1–6 are server-only and can be reviewed independently; tasks 7–16 are client-only; task 17 is integration.
- Tasks 11 and 12 both touch `grid.module.css`. Keep each task's CSS appended in order to avoid merge conflicts if parallelized.
