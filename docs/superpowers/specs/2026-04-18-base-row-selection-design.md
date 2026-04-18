# Base Row Selection & Bulk Delete — Design Spec

**Date:** 2026-04-18
**Status:** Approved
**Feature area:** `apps/client/src/features/base`, `apps/server/src/core/base`

## Goal

Let users select multiple rows in a base table via checkboxes and delete them in one action. The UI must feel native to the existing grid — checkbox affordance lives in the row-number column, a floating action bar handles the bulk action, and a new batch-delete endpoint avoids N round-trips.

## Non-goals

- Undo of deleted rows. Server still soft-deletes, but no UI restore in v1.
- Select-all-across-pages (only select-all-loaded in v1).
- Right-click row context menu.
- Bulk actions other than delete (no bulk edit, move, duplicate).
- Confirmation modals before delete (a post-delete toast is sufficient).

## UX design

### Row-number cell (selection affordance)

| State | Display |
|---|---|
| Default | Row index (`1`, `2`, …) — current behavior |
| Hover on row | Index hides; drag-handle grip icon + checkbox appear side by side |
| Row selected | Checkbox stays visible (checked); drag handle hidden; index hidden |

- Drag-handle and checkbox are distinct DOM regions. `onDragStart` stays only on the drag-handle element. Clicking the checkbox does not start a drag.
- Checkbox cell width stays at `ROW_NUMBER_COLUMN_WIDTH` (50px) — no layout shift.

### Header row-number cell (select-all toggle)

| State | Display |
|---|---|
| Default | `#` — current behavior |
| Header hover OR ≥1 row selected | Tri-state checkbox: unchecked / indeterminate / checked |

- Unchecked → checked: select all currently-loaded rows.
- Checked or indeterminate → unchecked: clear selection.
- Tooltip on hover: "Select all loaded rows".

### Selection interactions

- **Click checkbox** — toggle one row's selection.
- **Shift+click checkbox** — range-select from last toggled row index to this row index, within loaded rows. Uses the rendered row order (post-sort, post-filter).
- **Esc** (grid focused, not editing a cell) — clear selection.
- **Delete / Backspace** (grid focused, not editing a cell, ≥1 selected) — trigger bulk delete.
- Selection persists across scroll / virtualization.
- Selection is cleared on: `baseId` change, `activeViewId` change, active filter change, active sorts change.
- Selection is pruned when incoming realtime `base:row:deleted` or `base:rows:deleted` events remove a selected id.

### Floating action bar

- Renders when `selectionCount > 0`.
- Position: `absolute`, centered horizontally near the bottom of the grid wrapper, above "Add row", z-indexed above rows but below any portalled menus.
- Content (left → right): `{N} selected` · Delete button (red, `IconTrash`) · Clear button (`IconX`).
- Styling: Mantine `Paper` with `withBorder`, rounded, drop shadow; slide-up+fade transition (use `Transition` from Mantine with `mount="slide-up"`).
- On Delete click: fire `useDeleteRowsMutation`, clear selection, show Mantine notification `"{N} rows deleted"`.
- On Clear click: clear selection.

## Client architecture

### New state

**`apps/client/src/features/base/atoms/base-atoms.ts`**

```ts
export const selectedRowIdsAtom = atom<Set<string>>(new Set());
export const lastToggledRowIndexAtom = atom<number | null>(null);
```

`lastToggledRowIndexAtom` supports shift-click range selection. Stored as a rendered-row index (not a row id) because selection ranges follow visual order.

### New hook

**`apps/client/src/features/base/hooks/use-row-selection.ts`**

Exports `useRowSelection()` returning:

```ts
{
  selectedIds: Set<string>;
  selectionCount: number;
  isSelected: (rowId: string) => boolean;
  toggle: (rowId: string, opts: { shiftKey: boolean; rowIndex: number; orderedRowIds: string[] }) => void;
  toggleAll: (loadedRowIds: string[]) => void;
  clear: () => void;
  removeIds: (rowIds: string[]) => void; // for realtime pruning
}
```

- `toggle` with `shiftKey=true` and a valid `lastToggledIndex` selects (or deselects, based on the anchor's current state) the range `[min(lastIdx, rowIndex), max(lastIdx, rowIndex)]` among `orderedRowIds`.
- `toggleAll`: if every loaded id is already selected, clears; otherwise adds every loaded id to the set.

### New components

**`apps/client/src/features/base/components/grid/row-number-cell.tsx`** — extracted body-cell variant that renders the index / drag-handle+checkbox based on hover and selection state. Moves the `__row_number` branch out of `grid-cell.tsx` (which has grown long). Receives `rowId`, `rowIndex`, `orderedRowIds`, `rowDragProps`.

**`apps/client/src/features/base/components/grid/row-number-header-cell.tsx`** — tri-state checkbox for select-all-loaded, rendered from the header's `__row_number` branch.

**`apps/client/src/features/base/components/grid/selection-action-bar.tsx`** — floating bar. Takes `baseId`. Reads `selectedRowIdsAtom`. Owns its own mutation call + notification.

### New query hook

**`apps/client/src/features/base/queries/base-row-query.ts`** — add:

```ts
export function useDeleteRowsMutation()
// input: { baseId: string; rowIds: string[] }
// behavior: optimistic removal from all ["base-rows", baseId, ...] infinite-query pages;
// on error rollback snapshots + notification; registers one `requestId` via newRequestId().
```

Follows the exact pattern of the existing `useDeleteRowMutation`, generalized to filter out an array of ids in one pass. Existing `useDeleteRowMutation` stays unchanged.

### Modified files

- **`grid-cell.tsx`** — replace the inline `__row_number` branch with `<RowNumberCell rowId rowIndex orderedRowIds rowDragProps />`. No other logic changes.
- **`grid-header.tsx` / `grid-header-cell.tsx`** — replace the inline `__row_number` header branch with `<RowNumberHeaderCell />`.
- **`grid-container.tsx`** —
  - Pass `orderedRowIds` (from `table.getRowModel().rows`) down to rows so checkbox clicks can compute ranges.
  - Add keyboard handler on the scroll container: Delete/Backspace triggers bulk delete (when selection non-empty + not editing); Esc clears selection.
  - Mount `<SelectionActionBar baseId={baseId} />` inside the grid wrapper.
- **`base-table.tsx`** — add `useEffect` that clears `selectedRowIdsAtom` when `baseId`, `activeView?.id`, `activeFilter`, or `activeSorts` changes.
- **`use-base-socket.ts`** — add handler for new `base:rows:deleted` operation that (a) removes all `rowIds` from the base-rows cache in a single pass, and (b) prunes them from `selectedRowIdsAtom`. Also prune selection in the existing `base:row:deleted` handler.

### Styling

**`apps/client/src/features/base/styles/grid.module.css`** — add:
- `.rowNumberCellContent` — flex layout for grip + checkbox
- `.rowNumberCheckbox` hover-reveal rules (show when `.row:hover` or `.row.rowSelected`)
- `.rowSelected` row modifier — subtle background tint (`var(--mantine-color-blue-0)` light / `var(--mantine-color-dark-6)` dark)
- `.selectionActionBar` — absolute positioning, shadow, transition

## Server architecture

### New DTO

**`apps/server/src/core/base/dto/update-row.dto.ts`** — append:

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

### New event

**`apps/server/src/common/events/event.contants.ts`** — append `BASE_ROWS_DELETED = 'base.rows.deleted'`.

**`apps/server/src/core/base/events/base-events.ts`** — add:

```ts
export type BaseRowsDeletedEvent = {
  baseId: string;
  workspaceId: string;
  actorId: string | null;
  requestId: string | null;
  rowIds: string[];
};
```

### New controller endpoint

**`apps/server/src/core/base/controllers/base-row.controller.ts`** — append after existing `delete`:

```ts
@HttpCode(HttpStatus.OK)
@Post('delete-many')
async deleteMany(
  @Body() dto: DeleteRowsDto,
  @AuthUser() user: User,
  @AuthWorkspace() workspace: Workspace,
) {
  const base = await this.baseRepo.findById(dto.baseId);
  if (!base) throw new NotFoundException('Base not found');
  const ability = await this.spaceAbility.createForUser(user, base.spaceId);
  if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Base)) {
    throw new ForbiddenException();
  }
  await this.baseRowService.deleteMany(dto, workspace.id, user.id);
}
```

### New service method

**`apps/server/src/core/base/services/base-row.service.ts`**:

```ts
async deleteMany(dto: DeleteRowsDto, workspaceId: string, userId?: string) {
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

### Repository additions

**`apps/server/src/core/base/repositories/base-row.repository.ts`** (or equivalent) — add:

- `findByIds(ids: string[], scope: { workspaceId: string }): Promise<BaseRow[]>` — single `WHERE id = ANY($1) AND workspace_id = $2 AND deleted_at IS NULL`.
- `softDeleteMany(ids: string[], scope: { baseId: string; workspaceId: string }): Promise<void>` — single `UPDATE base_rows SET deleted_at = NOW() WHERE id = ANY($1) AND base_id = $2 AND workspace_id = $3`.

Both follow the Kysely patterns of existing `findById` / `softDelete`.

### Realtime consumer

**`apps/server/src/core/base/realtime/base-ws-consumers.ts`** — append:

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

Existing single-delete consumer/event is unchanged.

### Service layer registration

- Wire `DeleteRowsDto` into the controller imports.
- Register new endpoint in the service's public method list; ensure the new event name is exported alongside existing ones.
- No CASL changes needed — same `SpaceCaslAction.Edit` on `SpaceCaslSubject.Base` as existing `delete`.

## Client-service contract

**`apps/client/src/features/base/services/base-service.ts`** — append:

```ts
export async function deleteRows(data: { baseId: string; rowIds: string[]; requestId?: string }): Promise<void> {
  await api.post("/bases/rows/delete-many", data);
}
```

**`apps/client/src/features/base/types/base.types.ts`** — append `DeleteRowsInput`.

## Edge cases

| Case | Handling |
|---|---|
| Selection includes a row that another client deletes | Socket handler prunes from `selectedRowIdsAtom` |
| User selects >500 rows | Client chunks into sequential 500-id batches, one `requestId` per batch (all suppressed by socket echo filter). Fire-and-forget: toast shows once after all chunks resolve; no mid-progress UI in v1. |
| Header select-all clicked with 0 loaded rows | `<RowNumberHeaderCell />` renders nothing (no checkbox, no `#`) when `loadedRowIds.length === 0` to avoid a no-op control; `#` still shows if rows exist but none selected |
| "Grid focused" for Delete/Backspace/Esc | Defined as: the scroll container (`scrollRef.current`) contains `document.activeElement`. Keyboard handler attaches to the container; keys only fire when the event target is inside it. |
| Filter / sort change with rows selected | Selection is cleared — deliberate v1 choice (simple mental model). Users who want to filter-then-bulk-delete must filter first, then select. Acceptable tradeoff given select-all-loaded scope. |
| Delete API error mid-way (optimistic) | Rollback snapshots restore rows; notification surfaces error; selection remains |
| Delete key pressed while editing a cell | Guard: no-op when `editingCellAtom != null` |
| Clicking checkbox inside a row that's mid-drag | Drag handle and checkbox are separate elements; click on checkbox doesn't propagate drag |
| View / filter / sort changes with rows selected | Selection cleared via effect in `base-table.tsx` |
| Active view changes during delete request | Selection cleared; optimistic update still applies to the previous query key, server completes fine |

## Testing

### Server integration tests

File: `apps/server/src/core/base/services/base-row.service.spec.ts` (or equivalent integration test location following repo convention)

- `deleteMany` happy path: creates 3 rows, deletes all 3, asserts soft-delete + event emission with correct payload.
- Wrong-base rejected: 2 rows in base A + 1 in base B, `deleteMany` with all 3 for base A → `NotFoundException`, no rows deleted.
- Missing row → 404.
- Forbidden user (viewer) → `ForbiddenException` from controller.
- 500-row cap exceeded (DTO validation) → 400.

### Client tests

- `use-row-selection.test.ts` — toggle, shift-range (forward and reverse), toggleAll (mixed → all; all → none), clear, removeIds.
- `base-row-query.test.ts` (extend existing if present) — `useDeleteRowsMutation` optimistic removal + error rollback over multiple pages.

Component-level behavior (floating bar, hover checkbox, keyboard) verified manually.

## Rollout

- Single-commit-ready feature. No feature flag — endpoint is additive, UI is gated by selection state being non-empty.
- No database migrations.
- No API-breaking changes; existing single-row delete remains.
