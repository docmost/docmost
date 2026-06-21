import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Row, VisibilityState } from "@tanstack/react-table";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { triggerPostMoveFlash } from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import * as liveRegion from "@atlaskit/pragmatic-drag-and-drop-live-region";
import { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";
import { useRowSelection } from "@/ee/base/hooks/use-row-selection";
import { GridCell } from "./grid-cell";
import classes from "@/ee/base/styles/grid.module.css";

export const ROW_DRAG_TYPE = "base-row";

type GridRowProps = {
  row: Row<IBaseRow>;
  rowIndex: number;
  measureRef: (node: Element | null) => void;
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  onRowReorder?: (
    rowId: string,
    targetRowId: string,
    position: "above" | "below",
  ) => void;
  properties: IBaseProperty[];
  columnVisibility: VisibilityState;
  columnOrder: string[];
  pageId: string;
};

export const GridRow = memo(function GridRow({
  row,
  rowIndex,
  measureRef,
  onCellUpdate,
  onRowReorder,
  pageId,
}: GridRowProps) {
  const rowId = row.id;
  const isSelected = useRowSelection(pageId).isSelected(rowId);

  const rowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const setRowEl = useCallback(
    (node: HTMLDivElement | null) => {
      rowRef.current = node;
      measureRef(node);
    },
    [measureRef],
  );

  // onRowReorder ultimately depends on React Query result objects (activeView,
  // base) via persistViewConfig, and its identity changes on every WS-driven
  // cache invalidation. Holding it in a ref keeps it out of the DnD effect's
  // dep array so we don't tear down and re-register every row's pragmatic-dnd
  // adapter each time another user edits the base. Same pattern as the column
  // header's onColumnReorderRef.
  const onRowReorderRef = useRef(onRowReorder);
  useLayoutEffect(() => {
    onRowReorderRef.current = onRowReorder;
  });

  useEffect(() => {
    const rowEl = rowRef.current;
    if (!rowEl || !onRowReorder) return;
    // The whole row is the draggable element (full-row native preview).
    // dragHandle limits initiation to the grip, leaving cell clicks and
    // inline editing untouched.
    const handle = rowEl.querySelector<HTMLElement>(
      `.${classes.rowNumberDragHandle}`,
    );
    if (!handle) return;
    return combine(
      draggable({
        element: rowEl,
        dragHandle: handle,
        getInitialData: () => ({ type: ROW_DRAG_TYPE, rowId, pageId }),
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          // Native preview of the full-width sticky subgrid row rasterizes
          // garbled (it pulls in surrounding page paint, e.g. the sidebar).
          // Render a compact card that clones just the title cell instead.
          const titleCell =
            rowEl.querySelector<HTMLElement>(`.${classes.primaryCell}`) ??
            rowEl.querySelector<HTMLElement>(`.${classes.cell}`);
          if (!titleCell) return;
          const width = titleCell.getBoundingClientRect().width;
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({ x: "12px", y: "8px" }),
            render: ({ container }) => {
              const card = document.createElement("div");
              card.className = classes.rowDragPreview;
              card.style.width = `${width}px`;
              const clone = titleCell.cloneNode(true) as HTMLElement;
              clone.style.position = "static";
              clone.style.left = "auto";
              clone.style.width = "100%";
              clone.style.opacity = "1";
              clone.style.borderRight = "none";
              card.appendChild(clone);
              container.appendChild(card);
            },
          });
        },
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: rowEl,
        canDrop: ({ source }) =>
          source.data.type === ROW_DRAG_TYPE &&
          source.data.pageId === pageId &&
          source.data.rowId !== rowId,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { rowId },
            { input, element, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ source, self }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          onRowReorderRef.current?.(
            source.data.rowId as string,
            rowId,
            edge === "top" ? "above" : "below",
          );
          triggerPostMoveFlash(rowEl);
          liveRegion.announce("Moved row");
        },
      }),
    );
    // onRowReorder is read through onRowReorderRef; only its presence gates
    // registration, and that does not change across a row's mounted life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, pageId]);

  const dropIndicatorClass = closestEdge
    ? closestEdge === "top"
      ? classes.rowDropAbove
      : classes.rowDropBelow
    : "";

  return (
    <div
      ref={setRowEl}
      data-index={rowIndex}
      className={`${classes.row} ${classes.virtualRow} ${isDragging ? classes.rowDragging : ""} ${dropIndicatorClass} ${isSelected ? classes.rowSelected : ""}`}
      role="row"
      aria-rowindex={rowIndex + 1}
      aria-selected={isSelected}
    >
      {row.getVisibleCells().map((cell, colIndex) => (
        <GridCell
          key={cell.id}
          cell={cell}
          rowIndex={rowIndex}
          colIndex={colIndex}
          onCellUpdate={onCellUpdate}
          pageId={pageId}
        />
      ))}
    </div>
  );
},
gridRowPropsEqual);

// row compares by row.original: React Query structural sharing keeps
// unchanged rows reference-stable, while TanStack re-instantiates Row/Cell
// wrappers on every data change. properties/columnVisibility/columnOrder are
// layout busters — schema or column-state changes must re-render rows.
function gridRowPropsEqual(prev: GridRowProps, next: GridRowProps) {
  return (
    prev.row.id === next.row.id &&
    prev.row.original === next.row.original &&
    prev.rowIndex === next.rowIndex &&
    prev.pageId === next.pageId &&
    prev.onCellUpdate === next.onCellUpdate &&
    prev.onRowReorder === next.onRowReorder &&
    prev.measureRef === next.measureRef &&
    prev.properties === next.properties &&
    prev.columnVisibility === next.columnVisibility &&
    prev.columnOrder === next.columnOrder
  );
}
