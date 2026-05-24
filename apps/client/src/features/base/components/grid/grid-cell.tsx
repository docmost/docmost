import { memo, useCallback } from "react";
import { Cell } from "@tanstack/react-table";
import { useAtom } from "jotai";
import { IBaseRow, EditingCell } from "@/features/base/types/base.types";
import { editingCellAtomFamily } from "@/features/base/atoms/base-atoms";
import { isSystemPropertyType } from "@/features/base/hooks/use-base-table";
import { cellComponents } from "@/features/base/components/cells/cell-renderer";
import { RowNumberCell } from "./row-number-cell";
import classes from "@/features/base/styles/grid.module.css";

type RowDragProps = {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
};

type GridCellProps = {
  cell: Cell<IBaseRow, unknown>;
  rowIndex: number;
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  rowDragProps?: RowDragProps;
  orderedRowIds?: string[];
  pageId: string;
};

export const GridCell = memo(function GridCell({
  cell,
  rowIndex,
  onCellUpdate,
  rowDragProps,
  orderedRowIds,
  pageId,
}: GridCellProps) {
  const property = cell.column.columnDef.meta?.property;
  const isRowNumber = cell.column.id === "__row_number";
  const isPinned = cell.column.getIsPinned();
  const pinOffset = isPinned ? cell.column.getStart("left") : undefined;

  const [editingCell, setEditingCell] = useAtom(editingCellAtomFamily(pageId)) as unknown as [EditingCell, (val: EditingCell) => void];

  const rowId = cell.row.id;
  const isEditing =
    editingCell?.rowId === rowId &&
    editingCell?.propertyId === property?.id;

  const handleDoubleClick = useCallback(() => {
    if (!property || isRowNumber) return;
    if (property.type === "checkbox") return;
    if (isSystemPropertyType(property.type)) return;
    setEditingCell({ rowId, propertyId: property.id });
  }, [property, isRowNumber, rowId, setEditingCell]);

  const handleCommit = useCallback(
    (value: unknown) => {
      if (!property) return;
      const currentValue = cell.getValue();
      const hasChanged = value !== currentValue
        && !(value === "" && (currentValue === null || currentValue === undefined))
        && !(value === null && (currentValue === null || currentValue === undefined));
      if (hasChanged) {
        onCellUpdate(rowId, property.id, value);
      }
      setEditingCell(null);
    },
    [property, rowId, cell, onCellUpdate, setEditingCell],
  );

  const handleCancel = useCallback(() => {
    setEditingCell(null);
  }, [setEditingCell]);

  if (isRowNumber) {
    return (
      <RowNumberCell
        rowId={rowId}
        rowIndex={rowIndex}
        orderedRowIds={orderedRowIds ?? []}
        isPinned={Boolean(isPinned)}
        pinOffset={pinOffset}
        rowDragProps={rowDragProps}
        pageId={pageId}
      />
    );
  }

  if (!property) return null;

  const CellComponent = cellComponents[property.type];
  if (!CellComponent) return null;

  const value = cell.getValue();

  return (
    <div
      className={`${classes.cell} ${isPinned ? classes.cellPinned : ""} ${isEditing ? classes.cellEditing : ""} ${property.isPrimary ? classes.primaryCell : ""}`}
      style={
        isPinned
          ? ({ "--pin-offset": `${pinOffset}px` } as React.CSSProperties)
          : undefined
      }
      onDoubleClick={handleDoubleClick}
    >
      <CellComponent
        value={value}
        property={property}
        rowId={rowId}
        isEditing={isEditing}
        onCommit={handleCommit}
        onCancel={handleCancel}
      />
    </div>
  );
});
