import { useRef, useMemo, useCallback, useEffect, useState, useLayoutEffect } from "react";
import { Table } from "@tanstack/react-table";
import {
  observeWindowOffset,
  observeWindowRect,
  useVirtualizer,
  windowScroll,
} from "@tanstack/react-virtual";
import { useAtom, useSetAtom, type PrimitiveAtom } from "jotai";
import {
  IBaseRow,
  IBaseProperty,
  EditingCell,
  FocusedCell,
  CellCoord,
} from "@/ee/base/types/base.types";
import {
  editingCellAtomFamily,
  focusedCellAtomFamily,
  activeFormulaEditorAtomFamily,
  pendingTypeInsertAtom,
  type FormulaEditorTarget,
  type PendingTypeInsert,
} from "@/ee/base/atoms/base-atoms";
import { isSystemPropertyType } from "@/ee/base/property-types/property-type.registry";
import { useTranslation } from "react-i18next";
import { useColumnResize } from "@/ee/base/hooks/use-column-resize";
import { useGridKeyboardNav } from "@/ee/base/hooks/use-grid-keyboard-nav";
import { useRowAutoScroll } from "@/ee/base/hooks/use-row-autoscroll";
import { useRowSelection } from "@/ee/base/hooks/use-row-selection";
import { useDeleteSelectedRows } from "@/ee/base/hooks/use-delete-selected-rows";
import { useHorizontalScrollSync } from "@/ee/base/hooks/use-horizontal-scroll-sync";
import { useGridAutoScroll } from "@/ee/base/hooks/use-grid-autoscroll";
import { GridHeader } from "./grid-header";
import { GridRow } from "./grid-row";
import { AddRowButton } from "./add-row-button";
import { GridGhostRows } from "./grid-ghost-rows";
import { SelectionActionBar } from "./selection-action-bar";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import { useRowExpand } from "@/ee/base/context/row-expand";
import { GridRowOrderProvider } from "@/ee/base/context/grid-row-order";
import classes from "@/ee/base/styles/grid.module.css";

// Row box = 36px cell content + 1px row border-bottom. CSS pins .row to
// var(--base-row-height) from this constant so the rendered height can
// never drift from the virtualizer estimate.
const ROW_HEIGHT = 37;
const OVERSCAN = 25;

const GRID_ROOT_STYLE = {
  "--base-row-height": `${ROW_HEIGHT}px`,
} as React.CSSProperties;

const ADD_COLUMN_TRACK_WIDTH = 40;

// Hoisted to module scope to avoid allocating a fresh options object on
// every GridContainer render. The function refs from virtual-core are
// stable; only the wrapper object identity matters for downstream
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
  onAddRow?: (afterRowId?: string, focusPropertyId?: string) => void;
  pageId: string;
  onColumnReorder?: (columnId: string, finishIndex: number) => void;
  onResizeEnd?: () => void;
  onRowReorder?: (rowId: string, targetRowId: string, position: "above" | "below") => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onFetchNextPage?: () => void;
  /** true when a view filter with at least one condition is active; suppresses ghost rows */
  isFiltered?: boolean;
  /**
   * What the virtualizer measures and what the StickyBand sticks to.
   * Standalone passes a ref into the .tableScrollport wrapper; inline
   * passes `window` since the page itself is the scroll container.
   */
  scrollElement: HTMLElement | Window | null;
  /**
   * Rendered inside `[role=grid]` but ABOVE the sticky band, so it scrolls
   * with the content while only the column-header row stays pinned. In
   * inline mode BaseTable injects banner + toolbar here; standalone passes
   * null (they render outside the scrollport instead).
   */
  aboveBand?: React.ReactNode;
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
  isFiltered,
  scrollElement,
  aboveBand,
}: GridContainerProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  useHorizontalScrollSync(bodyRef, headerRef);
  useGridAutoScroll(bodyRef, pageId);
  useRowAutoScroll(scrollElement, pageId);
  const lastTriggeredRowsLenRef = useRef(0);
  const rows = table.getRowModel().rows;
  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const rowIdsRef = useRef(rowIds);
  rowIdsRef.current = rowIds;
  const getOrderedRowIds = useCallback(() => rowIdsRef.current, []);
  const editable = useBaseEditable();
  const onExpandRow = useRowExpand();

  const [editingCell, setEditingCell] = useAtom(editingCellAtomFamily(pageId)) as unknown as [EditingCell, (val: EditingCell) => void];
  const editingCellRef = useRef(editingCell);
  editingCellRef.current = editingCell;

  const { selectionCount, clear: clearSelection, toggle: toggleRow } = useRowSelection(pageId);
  const { deleteSelected } = useDeleteSelectedRows(pageId);

  const { t } = useTranslation();

  const [focusedCell, setFocusedCell] = useAtom(focusedCellAtomFamily(pageId)) as unknown as [FocusedCell, (val: FocusedCell) => void];
  const focusedCellRef = useRef(focusedCell);
  focusedCellRef.current = focusedCell;
  const [, setActiveFormulaEditor] = useAtom(activeFormulaEditorAtomFamily(pageId)) as unknown as [FormulaEditorTarget, (val: FormulaEditorTarget) => void];
  const setPendingTypeInsert = useSetAtom(pendingTypeInsertAtom as PrimitiveAtom<PendingTypeInsert>);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Only act while an inline cell editor is open. Popover-based cells
      // (select/status/person/page/date/file) self-dismiss via Mantine onChange.
      // This handler's sole job is to commit an inline input editor
      // (text/number/url/email) when the user clicks elsewhere, since clicking
      // a non-focusable cell does not natively blur the input. Gating on
      // editingCell also stops it from stealing focus from unrelated inputs.
      if (!editingCellRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest(`.${classes.headerCell}`)) return;
      if (target.closest("[role=\"dialog\"]")) return;
      if (target.closest("[role=\"listbox\"]")) return;
      if (target.closest("[data-mantine-shared-portal-node]")) return;
      if (target.closest(`.${classes.cellEditing}`)) return;
      // Blurring the input fires its onBlur -> commitOnce -> handleCommit,
      // which also clears editingCell. No setEditingCell(null) needed here.
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && typeof active.blur === "function") {
        active.blur();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  useColumnResize(table, onResizeEnd ?? (() => {}));


  // When the scroll container is the window (inline embed mode), the default
  // Element-mode observers read scrollTop/scrollLeft, which Window does not
  // have. Swap in the Window-mode observers so the virtualizer reads
  // scrollY/scrollX instead. The Element-narrowed type is satisfied by an
  // upcast on getScrollElement; virtual-core's runtime accepts Window when
  // the observers do.
  const isWindowScroll =
    typeof window !== "undefined" && scrollElement === window;
  const windowScrollOptions = isWindowScroll ? WINDOW_SCROLL_OPTIONS : {};

  // Rows are positioned inside .rowsContainer, which sits below the sticky
  // band (and aboveBand content) within the scroll content. scrollMargin =
  // the container's offset from the scroll content top, in both modes, so
  // virtual indexing lines up with what is actually on screen.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const el = rowsContainerRef.current;
    if (!el || !scrollElement) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (isWindowScroll) {
        setScrollMargin(rect.top + window.scrollY);
      } else {
        const scrollport = scrollElement as HTMLElement;
        setScrollMargin(
          rect.top -
            scrollport.getBoundingClientRect().top +
            scrollport.scrollTop,
        );
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Outer page reflows (sidebar collapse, viewport resize) can move the
    // grid without resizing it, so listen to window resize too.
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isWindowScroll, scrollElement]);

  // Stable row-id keys: the direct-update element cache and measurement
  // cache are keyed by item key, so index keys would go stale whenever rows
  // are inserted or reordered above the viewport.
  const getItemKey = useCallback(
    (index: number) => rowIds[index] ?? index,
    [rowIds],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement as Element | null,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    scrollMargin,
    getItemKey,
    directDomUpdates: true,
    // 'position' (writes `top`), not 'transform': a transform on the row
    // creates a containing block that breaks the position:sticky pinned
    // cells inside it.
    directDomUpdatesMode: "position",
    ...windowScrollOptions,
    // virtual-core bug: on first attach _willUpdate calls
    // _scrollToOffset(getScrollOffset()), which returns undefined when no
    // initialOffset is provided. windowScroll then computes undefined + 0 = NaN,
    // browsers coerce it to 0, and scrollY snaps to 0 when the embed mounts
    // mid-page. Seeding initialOffset to the current scroll position makes
    // the first _scrollToOffset a no-op.
    initialOffset: isWindowScroll
      ? () => window.scrollY
      : () =>
          scrollElement instanceof HTMLElement ? scrollElement.scrollTop : 0,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const pinnedLeftWidth = useCallback(
    () =>
      table
        .getVisibleLeafColumns()
        .filter((c) => c.getIsPinned() === "left")
        .reduce((sum, c) => sum + c.getSize(), 0),
    [table],
  );

  const scrollCellIntoView = useCallback(
    (coord: CellCoord, rowIndex: number) => {
      if (rowIndex >= 0) virtualizer.scrollToIndex(rowIndex, { align: "auto" });
      requestAnimationFrame(() => {
        const scroller = bodyRef.current;
        const el = document.getElementById(
          `base-cell-${coord.rowId}-${coord.propertyId}`,
        );
        if (!scroller || !el) return;
        const cellRect = el.getBoundingClientRect();
        const scRect = scroller.getBoundingClientRect();
        const pinned = pinnedLeftWidth();
        if (cellRect.left < scRect.left + pinned) {
          scroller.scrollLeft -= scRect.left + pinned - cellRect.left;
        } else if (cellRect.right > scRect.right) {
          scroller.scrollLeft += cellRect.right - scRect.right;
        }
      });
    },
    [virtualizer, pinnedLeftWidth],
  );

  useEffect(() => {
    if (!editingCell) return;
    const idx = rowIdsRef.current.indexOf(editingCell.rowId);
    if (idx >= 0) scrollCellIntoView(editingCell, idx);
  }, [editingCell, scrollCellIntoView]);

  const openEditor = useCallback(
    (coord: CellCoord) => {
      const prop = properties.find((p) => p.id === coord.propertyId);
      if (!prop) return;
      if (prop.type === "checkbox") {
        if (!editable) return;
        const current = table.getRow(coord.rowId, true)?.getValue(coord.propertyId);
        onCellUpdate(coord.rowId, coord.propertyId, !current);
        return;
      }
      if (!editable) {
        if (prop.type === "file") setEditingCell(coord);
        return;
      }
      if (prop.type === "formula") {
        setActiveFormulaEditor({ propertyId: coord.propertyId, rowId: coord.rowId });
        return;
      }
      if (isSystemPropertyType(prop.type)) return;
      setEditingCell(coord);
    },
    [properties, editable, table, onCellUpdate, setEditingCell, setActiveFormulaEditor],
  );

  const clearCell = useCallback(
    (coord: CellCoord) => {
      if (!editable) return;
      const prop = properties.find((p) => p.id === coord.propertyId);
      if (!prop || isSystemPropertyType(prop.type)) return;
      onCellUpdate(coord.rowId, coord.propertyId, null);
    },
    [editable, properties, onCellUpdate],
  );

  const beginTypeToEdit = useCallback(
    (coord: CellCoord, char: string) => {
      if (!editable) return;
      const prop = properties.find((p) => p.id === coord.propertyId);
      if (!prop || isSystemPropertyType(prop.type) || prop.type === "checkbox") return;
      if (["text", "number", "url", "email"].includes(prop.type)) {
        setPendingTypeInsert({ rowId: coord.rowId, propertyId: coord.propertyId, char });
        setEditingCell(coord);
      } else {
        openEditor(coord);
      }
    },
    [editable, properties, setPendingTypeInsert, setEditingCell, openEditor],
  );

  const toggleRowSelection = useCallback(
    (rowId: string) => {
      toggleRow(rowId, {
        shiftKey: false,
        rowIndex: rowIdsRef.current.indexOf(rowId),
        orderedRowIds: rowIdsRef.current,
      });
    },
    [toggleRow],
  );

  const expandRow = useCallback(
    (rowId: string) => {
      onExpandRow?.(rowId);
    },
    [onExpandRow],
  );

  const prevEditingRef = useRef(editingCell);
  useEffect(() => {
    const prev = prevEditingRef.current;
    prevEditingRef.current = editingCell;
    if (prev && !editingCell) {
      if (!focusedCellRef.current) setFocusedCell(prev);
      const grid = bodyRef.current;
      const active = document.activeElement;
      if (grid && active && !grid.contains(active)) {
        grid.focus({ preventScroll: true });
      }
    }
  }, [editingCell, setFocusedCell]);

  useEffect(() => {
    const fc = focusedCellRef.current;
    if (!fc) return;
    const rowOk = rowIds.includes(fc.rowId);
    const colOk = table.getVisibleLeafColumns().some((c) => c.id === fc.propertyId);
    if (!rowOk || !colOk) setFocusedCell(null);
  }, [rowIds, table.getState().columnVisibility, table.getState().columnOrder, setFocusedCell]);

  const handleGridFocus = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (editingCellRef.current || focusedCellRef.current) return;
      const firstRow = rowIdsRef.current[0];
      const firstCol = table
        .getVisibleLeafColumns()
        .find((c) => c.id !== "__row_number")?.id;
      if (firstRow && firstCol) setFocusedCell({ rowId: firstRow, propertyId: firstCol });
    },
    [table, setFocusedCell],
  );

  const handleAddRowBelow = useCallback(
    (afterRowId: string, focusPropertyId: string) => {
      onAddRow?.(afterRowId, focusPropertyId);
    },
    [onAddRow],
  );

  useGridKeyboardNav({
    table,
    properties,
    containerRef: bodyRef,
    focusedCell,
    setFocusedCell,
    editingCell,
    setEditingCell,
    openEditor,
    clearCell,
    beginTypeToEdit,
    scrollCellIntoView,
    selectionCount,
    clearSelection,
    deleteSelected,
    toggleRowSelection,
    expandRow,
    addRow: handleAddRowBelow,
  });

  const activeCell = editingCell ?? focusedCell;
  const activeDescendantId = activeCell
    ? `base-cell-${activeCell.rowId}-${activeCell.propertyId}`
    : undefined;

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
    // When the row set shrinks (filter/sort/view change) or resets to zero,
    // un-gate the trigger so the first page can trigger the next fetch correctly.
    if (rows.length === 0 || rows.length < lastTriggeredRowsLenRef.current) {
      lastTriggeredRowsLenRef.current = 0;
    }
  }, [rows.length]);


  const gridTemplateColumns = useMemo(() => {
    const visibleColumns = table.getVisibleLeafColumns();
    const columnWidths = visibleColumns.map((col) => `${col.getSize()}px`);
    return (
      columnWidths.join(" ") +
      (pageId && editable ? ` ${ADD_COLUMN_TRACK_WIDTH}px` : "")
    );
  }, [table, table.getState().columnSizing, table.getState().columnVisibility, table.getState().columnOrder, pageId, editable]);

  const totalColumnsWidth = useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .reduce((sum, col) => sum + col.getSize(), 0) +
      (pageId && editable ? ADD_COLUMN_TRACK_WIDTH : 0),
    [table, table.getState().columnSizing, table.getState().columnVisibility, table.getState().columnOrder, pageId, editable],
  );

  const showGhostRows = rows.length === 0 && !isFiltered;
  // Append a flexible trailing track so every row spans the full width.
  // minmax(0, 1fr) collapses to 0 when columns overflow the viewport and
  // fills remaining width otherwise. The header grid keeps the plain template.
  const bodyGridTemplateColumns = `${gridTemplateColumns} minmax(0, 1fr)`;

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

  const getColumnOrder = useCallback(
    () => table.getState().columnOrder,
    [table],
  );

  return (
    <div style={GRID_ROOT_STYLE}>
      {aboveBand}
      <div className={classes.stickyBand}>
        <div
          className={classes.headerGrid}
          ref={headerRef}
          style={{ gridTemplateColumns }}
          role="row"
        >
          <GridHeader
            table={table}
            pageId={pageId}
            columnOrder={table.getState().columnOrder}
            columnVisibility={table.getState().columnVisibility}
            properties={properties}
            loadedRowIds={rowIds}
            onPropertyCreated={handlePropertyCreated}
            getColumnOrder={getColumnOrder}
            onColumnReorder={onColumnReorder}
          />
        </div>
      </div>
        <GridRowOrderProvider value={getOrderedRowIds}>
          <div
            className={classes.bodyGrid}
            ref={bodyRef}
            tabIndex={0}
            role="grid"
            aria-label={t("Base table")}
            aria-rowcount={rows.length}
            aria-colcount={table.getVisibleLeafColumns().length}
            aria-multiselectable
            aria-activedescendant={activeDescendantId}
            onFocus={handleGridFocus}
            style={
              {
                "--base-grid-cols": bodyGridTemplateColumns,
              } as React.CSSProperties
            }
          >
            <div
              className={classes.rowsContainer}
              ref={(node) => {
                rowsContainerRef.current = node;
                virtualizer.containerRef(node);
              }}
              role="rowgroup"
              style={{ width: totalColumnsWidth, minWidth: "100%" }}
            >
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                return (
                  <GridRow
                    key={row.id}
                    row={row}
                    rowIndex={virtualRow.index}
                    measureRef={virtualizer.measureElement}
                    onCellUpdate={onCellUpdate}
                    properties={properties}
                    columnVisibility={table.getState().columnVisibility}
                    columnOrder={table.getState().columnOrder}
                    pageId={pageId}
                    onRowReorder={onRowReorder}
                  />
                );
              })}
            </div>
            {showGhostRows && (
              <GridGhostRows
                count={3}
                columnCount={table.getVisibleLeafColumns().length}
                onCreate={editable ? handleAddRow : undefined}
              />
            )}
            {editable && <AddRowButton onClick={handleAddRow} />}
            {pageId && <SelectionActionBar pageId={pageId} />}
          </div>
        </GridRowOrderProvider>
    </div>
  );
}
