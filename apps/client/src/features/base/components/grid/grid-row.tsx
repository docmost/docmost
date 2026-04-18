import { memo, useCallback } from "react";
import { Row } from "@tanstack/react-table";
import { IBaseRow } from "@/features/base/types/base.types";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import { GridCell } from "./grid-cell";
import classes from "@/features/base/styles/grid.module.css";

type RowDragHandlers = {
  onDragStart: (rowId: string) => void;
  onDragOver: (rowId: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragLeave: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
  dropPosition: "above" | "below" | null;
};

type GridRowProps = {
  row: Row<IBaseRow>;
  rowIndex: number;
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  dragHandlers?: RowDragHandlers;
  orderedRowIds: string[];
};

export const GridRow = memo(function GridRow({
  row,
  rowIndex,
  onCellUpdate,
  dragHandlers,
  orderedRowIds,
}: GridRowProps) {
  const isSelected = useRowSelection().isSelected(row.id);
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", row.id);
      dragHandlers?.onDragStart(row.id);
    },
    [row.id, dragHandlers],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      dragHandlers?.onDragOver(row.id, e);
    },
    [row.id, dragHandlers],
  );

  const dropIndicatorClass = dragHandlers?.isDropTarget
    ? dragHandlers.dropPosition === "above"
      ? classes.rowDropAbove
      : classes.rowDropBelow
    : "";

  return (
    <div
      className={`${classes.row} ${dragHandlers?.isDragging ? classes.rowDragging : ""} ${dropIndicatorClass} ${isSelected ? classes.rowSelected : ""}`}
      role="row"
      onDragOver={handleDragOver}
      onDrop={(e) => {
        e.preventDefault();
        dragHandlers?.onDragEnd();
      }}
      onDragLeave={dragHandlers?.onDragLeave}
    >
      {row.getVisibleCells().map((cell) => {
        const isRowNumber = cell.column.id === "__row_number";
        return (
          <GridCell
            key={cell.id}
            cell={cell}
            rowIndex={rowIndex}
            onCellUpdate={onCellUpdate}
            orderedRowIds={orderedRowIds}
            rowDragProps={
              isRowNumber && dragHandlers
                ? {
                    draggable: true,
                    onDragStart: handleDragStart,
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
});
