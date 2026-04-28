import { useRef, useMemo, useCallback, useEffect, useState, useLayoutEffect } from "react";
import { Table } from "@tanstack/react-table";
import {
  observeWindowOffset,
  observeWindowRect,
  useVirtualizer,
  windowScroll,
} from "@tanstack/react-virtual";
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
import { IBaseRow, IBaseProperty, EditingCell } from "@/features/base/types/base.types";
import { editingCellAtomFamily, activePropertyMenuAtomFamily, propertyMenuDirtyAtomFamily, propertyMenuCloseRequestAtomFamily } from "@/features/base/atoms/base-atoms";
import { useColumnResize } from "@/features/base/hooks/use-column-resize";
import { useGridKeyboardNav } from "@/features/base/hooks/use-grid-keyboard-nav";
import { useRowDrag } from "@/features/base/hooks/use-row-drag";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import { useDeleteSelectedRows } from "@/features/base/hooks/use-delete-selected-rows";
import { useHorizontalScrollSync } from "@/features/base/hooks/use-horizontal-scroll-sync";
import { GridHeader } from "./grid-header";
import { GridRow } from "./grid-row";
import { AddRowButton } from "./add-row-button";
import { SelectionActionBar } from "./selection-action-bar";
import classes from "@/features/base/styles/grid.module.css";

const ROW_HEIGHT = 36;
const OVERSCAN = 10;

// Hoisted to module scope so we don't allocate a fresh options object
// every GridContainer render — the function refs from virtual-core are
// stable, only the wrapper object identity matters for downstream
// memoization inside useVirtualizer.
const WINDOW_SCROLL_OPTIONS = {
  observeElementRect: observeWindowRect as never,
  observeElementOffset: observeWindowOffset as never,
  scrollToFn: windowScroll as never,
} as const;

type GridContainerProps = {
  table: Table<IBaseRow>;
  properties: IBaseProperty[];
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  onAddRow?: () => void;
  pageId: string;
  onColumnReorder?: (columnId: string, overColumnId: string) => void;
  onResizeEnd?: () => void;
  onRowReorder?: (rowId: string, targetRowId: string, position: "above" | "below") => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onFetchNextPage?: () => void;
  /**
   * What the virtualizer measures and what the StickyBand sticks to.
   * Standalone passes a ref into the .tableScrollport wrapper; inline
   * passes `window` since the page itself is the scroll container.
   */
  scrollElement: HTMLElement | Window | null;
  /**
   * Rendered above the column-header row inside the StickyBand. In
   * inline mode BaseTable injects banner + toolbar here so they stick
   * alongside the headers; in standalone this is null (banner +
   * toolbar render outside the scrollport).
   */
  stickyBandPrelude?: React.ReactNode;
};

export function GridContainer({
  table,
  properties,
  onCellUpdate,
  onAddRow,
  pageId,
  onColumnReorder,
  onResizeEnd,
  onRowReorder,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
  scrollElement,
  stickyBandPrelude,
}: GridContainerProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useHorizontalScrollSync(bodyRef, headerRef);
  const lastTriggeredRowsLenRef = useRef(0);
  const rows = table.getRowModel().rows;

  const [editingCell, setEditingCell] = useAtom(editingCellAtomFamily(pageId)) as unknown as [EditingCell, (val: EditingCell) => void];
  const [, setActivePropertyMenu] = useAtom(activePropertyMenuAtomFamily(pageId)) as unknown as [string | null, (val: string | null) => void];
  const [propertyMenuDirty] = useAtom(propertyMenuDirtyAtomFamily(pageId)) as unknown as [boolean];
  const [, setCloseRequest] = useAtom(propertyMenuCloseRequestAtomFamily(pageId)) as unknown as [number, (val: number) => void];
  const propertyMenuDirtyRef = useRef(propertyMenuDirty);
  propertyMenuDirtyRef.current = propertyMenuDirty;
  const closeRequestCounterRef = useRef(0);

  const { selectionCount, clear: clearSelection } = useRowSelection(pageId);
  const { deleteSelected } = useDeleteSelectedRows(pageId);

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
    containerRef: bodyRef,
  });

  // When the scroll container is the window (inline embed mode),
  // useVirtualizer's default Element-mode observers read scrollTop /
  // scrollLeft — properties Window doesn't have. Swap in the Window-
  // mode observers so the virtualizer reads scrollY / scrollX instead.
  // The Element-narrowed type signature is satisfied by an upcast on
  // getScrollElement: virtual-core's runtime accepts Window when the
  // observers do.
  const isWindowScroll =
    typeof window !== "undefined" && scrollElement === window;
  const windowScrollOptions = isWindowScroll ? WINDOW_SCROLL_OPTIONS : {};

  // Window-mode virtualizer reads window.scrollY as offset, but rows
  // are positioned within .bodyGrid which sits at some non-zero Y in
  // the document (below banner/toolbar/upstream page content). Pass
  // scrollMargin = bodyGrid's document-relative top so the virtualizer
  // indexes correctly. Re-measure on resize via ResizeObserver — the
  // embed extension logic in BaseEmbedView already triggers layout
  // changes that we need to react to.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    if (!isWindowScroll) return;
    const el = bodyRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScrollMargin(rect.top + window.scrollY);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Outer page reflows (sidebar collapse, viewport resize) move the
    // embed without resizing it — listen to window resize too.
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isWindowScroll]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement as Element | null,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    scrollMargin,
    ...windowScrollOptions,
    // virtual-core bug: when the scroll element first attaches in
    // _willUpdate, it calls _scrollToOffset(getScrollOffset()). With
    // no initialOffset provided, getScrollOffset() returns undefined,
    // and windowScroll/elementScroll computes `undefined + 0 = NaN`
    // for the scroll target. Browsers coerce that to 0, so
    // scrollY/scrollTop snaps to 0 the moment a fresh BaseTable
    // mounts mid-page — manifests as "page jumps to top of editor"
    // when an inline-embed lands. Seed initialOffset to the current
    // scroll position so the first _scrollToOffset is a no-op.
    initialOffset: isWindowScroll
      ? () => window.scrollY
      : () =>
          scrollElement instanceof HTMLElement ? scrollElement.scrollTop : 0,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !onFetchNextPage) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    if (lastItem.index < rows.length - OVERSCAN * 2) return;
    if (rows.length <= lastTriggeredRowsLenRef.current) return;
    lastTriggeredRowsLenRef.current = rows.length;
    onFetchNextPage();
  }, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, onFetchNextPage]);

  useEffect(() => {
    // When the underlying row set shrinks (filter changed, sort toggled,
    // view switched) or resets to zero, we're on a fresh pagination
    // sequence — un-gate the trigger so the first page triggers a
    // potential next fetch correctly.
    if (rows.length === 0 || rows.length < lastTriggeredRowsLenRef.current) {
      lastTriggeredRowsLenRef.current = 0;
    }
  }, [rows.length]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !pageId) return;
    const handler = (e: KeyboardEvent) => {
      if (editingCell) return;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !el.contains(active)) return;
      const tag = active.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || active.isContentEditable) {
        return;
      }
      if (e.key === "Escape" && selectionCount > 0) {
        clearSelection();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectionCount > 0) {
        e.preventDefault();
        void deleteSelected();
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [editingCell, selectionCount, clearSelection, deleteSelected, pageId]);

  const gridTemplateColumns = useMemo(() => {
    const visibleColumns = table.getVisibleLeafColumns();
    const columnWidths = visibleColumns.map((col) => `${col.getSize()}px`);
    return columnWidths.join(" ") + (pageId ? " 40px" : "");
  }, [table, table.getState().columnSizing, table.getState().columnVisibility, table.getState().columnOrder, pageId]);

  const totalHeight = virtualizer.getTotalSize();

  // virtual-core bakes `scrollMargin` into both `start`/`end` and
  // `getTotalSize()`. We render padding spacers inside .bodyGrid to
  // position rows in the grid flow, so paddingTop must be relative to
  // .bodyGrid's own top — subtract scrollMargin out of items[0].start
  // (which would otherwise push the first row down by the full embed
  // offset, leaving a giant blank gap above the data). totalHeight
  // already includes scrollMargin, so paddingBottom needs no
  // adjustment.
  const paddingTop =
    virtualItems.length > 0
      ? Math.max(0, (virtualItems[0]?.start ?? 0) - scrollMargin)
      : 0;
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

  const handlePropertyCreated = useCallback(() => {
    // Wait for React to re-render with the new column, then scroll to it
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bodyRef.current?.scrollTo({
          left: bodyRef.current.scrollWidth,
          behavior: "smooth",
        });
      });
    });
  }, []);

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
      <div role="grid">
        <div className={classes.stickyBand}>
          {stickyBandPrelude}
          <div
            className={classes.headerGrid}
            ref={headerRef}
            style={{ gridTemplateColumns }}
            role="row"
          >
            <SortableContext
              items={sortableColumnIds}
              strategy={horizontalListSortingStrategy}
            >
              <GridHeader
                table={table}
                pageId={pageId}
                columnOrder={table.getState().columnOrder}
                columnVisibility={table.getState().columnVisibility}
                properties={properties}
                loadedRowIds={rowIds}
                onPropertyCreated={handlePropertyCreated}
              />
            </SortableContext>
          </div>
        </div>
        <div
          className={classes.bodyGrid}
          ref={bodyRef}
          tabIndex={0}
          style={{ gridTemplateColumns }}
          role="rowgroup"
        >
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
                orderedRowIds={rowIds}
                columnVisibility={table.getState().columnVisibility}
                pageId={pageId}
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
          {pageId && <SelectionActionBar pageId={pageId} />}
        </div>
      </div>
    </DndContext>
  );
}
