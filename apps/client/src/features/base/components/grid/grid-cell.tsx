import { memo, useCallback } from "react";
import { Cell } from "@tanstack/react-table";
import { useAtom } from "jotai";
import { IBaseRow, IBaseProperty, EditingCell } from "@/features/base/types/base.types";
import { editingCellAtom } from "@/features/base/atoms/base-atoms";
import { isSystemPropertyType } from "@/features/base/hooks/use-base-table";
import { CellText } from "@/features/base/components/cells/cell-text";
import { CellNumber } from "@/features/base/components/cells/cell-number";
import { CellSelect } from "@/features/base/components/cells/cell-select";
import { CellStatus } from "@/features/base/components/cells/cell-status";
import { CellMultiSelect } from "@/features/base/components/cells/cell-multi-select";
import { CellDate } from "@/features/base/components/cells/cell-date";
import { CellCheckbox } from "@/features/base/components/cells/cell-checkbox";
import { CellUrl } from "@/features/base/components/cells/cell-url";
import { CellEmail } from "@/features/base/components/cells/cell-email";
import { CellPerson } from "@/features/base/components/cells/cell-person";
import { CellFile } from "@/features/base/components/cells/cell-file";
import { CellPage } from "@/features/base/components/cells/cell-page";
import { CellCreatedAt } from "@/features/base/components/cells/cell-created-at";
import { CellLastEditedAt } from "@/features/base/components/cells/cell-last-edited-at";
import { CellLastEditedBy } from "@/features/base/components/cells/cell-last-edited-by";
import { RowNumberCell } from "./row-number-cell";
import classes from "@/features/base/styles/grid.module.css";

type CellComponentProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

const cellComponents: Record<
  string,
  React.ComponentType<CellComponentProps>
> = {
  text: CellText,
  number: CellNumber,
  select: CellSelect,
  status: CellStatus,
  multiSelect: CellMultiSelect,
  date: CellDate,
  checkbox: CellCheckbox,
  url: CellUrl,
  email: CellEmail,
  person: CellPerson,
  file: CellFile,
  page: CellPage,
  createdAt: CellCreatedAt,
  lastEditedAt: CellLastEditedAt,
  lastEditedBy: CellLastEditedBy,
};

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
};

export const GridCell = memo(function GridCell({
  cell,
  rowIndex,
  onCellUpdate,
  rowDragProps,
  orderedRowIds,
}: GridCellProps) {
  const property = cell.column.columnDef.meta?.property;
  const isRowNumber = cell.column.id === "__row_number";
  const isPinned = cell.column.getIsPinned();
  const pinOffset = isPinned ? cell.column.getStart("left") : undefined;

  const [editingCell, setEditingCell] = useAtom(editingCellAtom) as unknown as [EditingCell, (val: EditingCell) => void];

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
      style={{
        ...(isPinned ? { left: pinOffset } : {}),
      }}
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
