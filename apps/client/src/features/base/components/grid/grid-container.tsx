import { useRef, useMemo, useCallback, useEffect } from "react";
import { Table } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAtom } from "jotai";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { IBaseRow, EditingCell } from "@/features/base/types/base.types";
import { editingCellAtom, activePropertyMenuAtom, propertyMenuDirtyAtom, propertyMenuCloseRequestAtom } from "@/features/base/atoms/base-atoms";
import { useColumnResize } from "@/features/base/hooks/use-column-resize";
import { useGridKeyboardNav } from "@/features/base/hooks/use-grid-keyboard-nav";
import { useRowDrag } from "@/features/base/hooks/use-row-drag";
import { GridHeader } from "./grid-header";
import { GridRow } from "./grid-row";
import { AddRowButton } from "./add-row-button";
import classes from "@/features/base/styles/grid.module.css";

const ROW_HEIGHT = 36;
const OVERSCAN = 10;

type GridContainerProps = {
  table: Table<IBaseRow>;
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  onAddRow?: () => void;
  onAddColumn?: () => void;
  onColumnReorder?: (columnId: string, overColumnId: string) => void;
  onResizeEnd?: () => void;
  onRowReorder?: (rowId: string, targetRowId: string, position: "above" | "below") => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onFetchNextPage?: () => void;
};

export function GridContainer({
  table,
  onCellUpdate,
  onAddRow,
  onAddColumn,
  onColumnReorder,
  onResizeEnd,
  onRowReorder,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
}: GridContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;

  const [editingCell, setEditingCell] = useAtom(editingCellAtom) as unknown as [EditingCell, (val: EditingCell) => void];
  const [, setActivePropertyMenu] = useAtom(activePropertyMenuAtom) as unknown as [string | null, (val: string | null) => void];
  const [propertyMenuDirty] = useAtom(propertyMenuDirtyAtom) as unknown as [boolean];
  const [, setCloseRequest] = useAtom(propertyMenuCloseRequestAtom) as unknown as [number, (val: number) => void];
  const propertyMenuDirtyRef = useRef(propertyMenuDirty);
  propertyMenuDirtyRef.current = propertyMenuDirty;
  const closeRequestCounterRef = useRef(0);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(`.${classes.headerCell}`)) return;
      if (target.closest("[role=\"dialog\"]")) return;
      if (target.closest("[role=\"listbox\"]")) return;
      if (target.closest("[data-mantine-shared-portal-node]")) return;
      if (target.closest(`.${classes.cellEditing}`)) return;
      if (propertyMenuDirtyRef.current) {
        closeRequestCounterRef.current += 1;
        setCloseRequest(closeRequestCounterRef.current);
      } else {
        setActivePropertyMenu(null);
      }
      setEditingCell(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [setActivePropertyMenu, setEditingCell, setCloseRequest]);

  useColumnResize(table, onResizeEnd ?? (() => {}));

  useGridKeyboardNav({
    table,
    editingCell,
    setEditingCell,
    containerRef: scrollRef,
  });

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !onFetchNextPage) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    if (lastItem.index >= rows.length - OVERSCAN * 2) {
      onFetchNextPage();
    }
  }, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, onFetchNextPage]);

  const gridTemplateColumns = useMemo(() => {
    const visibleColumns = table.getVisibleLeafColumns();
    const columnWidths = visibleColumns.map((col) => `${col.getSize()}px`);
    return columnWidths.join(" ") + (onAddColumn ? " 40px" : "");
  }, [table, table.getState().columnSizing, table.getState().columnVisibility, onAddColumn]);

  const totalHeight = virtualizer.getTotalSize();

  const paddingTop =
    virtualItems.length > 0 ? virtualItems[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalHeight - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const handleRowReorder = useCallback(
    (rowId: string, targetRowId: string, position: "above" | "below") => {
      onRowReorder?.(rowId, targetRowId, position);
    },
    [onRowReorder],
  );

  const {
    dragState: rowDragState,
    handleDragStart: handleRowDragStart,
    handleDragOver: handleRowDragOver,
    handleDragEnd: handleRowDragEnd,
    handleDragLeave: handleRowDragLeave,
  } = useRowDrag({ rowIds, onReorder: handleRowReorder });

  const handleAddRow = useCallback(() => {
    onAddRow?.();
  }, [onAddRow]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const sortableColumnIds = useMemo(() => {
    return table
      .getVisibleLeafColumns()
      .filter((col) => col.id !== "__row_number")
      .map((col) => col.id);
  }, [table, table.getState().columnOrder]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      onColumnReorder?.(active.id as string, over.id as string);
    },
    [onColumnReorder],
  );

  const modifiers = useMemo(() => [restrictToHorizontalAxis], []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={modifiers}
    >
      <div
        className={classes.gridWrapper}
        ref={scrollRef}
        tabIndex={0}
      >
        <div
          className={classes.grid}
          style={{ gridTemplateColumns }}
          role="grid"
        >
          <SortableContext
            items={sortableColumnIds}
            strategy={horizontalListSortingStrategy}
          >
            <GridHeader table={table} onAddColumn={onAddColumn} />
          </SortableContext>

          {paddingTop > 0 && (
            <div style={{ height: paddingTop, gridColumn: "1 / -1" }} />
          )}

          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            return (
              <GridRow
                key={row.id}
                row={row}
                rowIndex={virtualRow.index}
                onCellUpdate={onCellUpdate}
                dragHandlers={
                  onRowReorder
                    ? {
                        onDragStart: handleRowDragStart,
                        onDragOver: handleRowDragOver,
                        onDragEnd: handleRowDragEnd,
                        onDragLeave: handleRowDragLeave,
                        isDragging: rowDragState.dragRowId === row.id,
                        isDropTarget: rowDragState.dropTargetRowId === row.id,
                        dropPosition: rowDragState.dropTargetRowId === row.id ? rowDragState.dropPosition : null,
                      }
                    : undefined
                }
              />
            );
          })}

          {paddingBottom > 0 && (
            <div style={{ height: paddingBottom, gridColumn: "1 / -1" }} />
          )}

          <AddRowButton onClick={handleAddRow} />
        </div>
      </div>
    </DndContext>
  );
}
