import { memo, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { Cell } from "@tanstack/react-table";
import { Popover, Tooltip } from "@mantine/core";
import { IconArrowsDiagonal } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAtom, useAtomValue, useSetAtom, type PrimitiveAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import { IBaseRow, EditingCell, FocusedCell } from "@/ee/base/types/base.types";
import {
  editingCellAtomFamily,
  focusedCellAtomFamily,
  activeFormulaEditorAtomFamily,
  FormulaEditorTarget,
} from "@/ee/base/atoms/base-atoms";
import { FormulaPropertyEditor } from "@/ee/base/components/formula/formula-property-editor";
import {
  isSystemPropertyType,
  getDescriptor,
} from "@/ee/base/property-types/property-type.registry";
import { cellValuesEqual } from "@/ee/base/components/cells/cell-value-equal";
import { computeNextCell } from "@/ee/base/utils/grid-cell-nav";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import { useRowExpand } from "@/ee/base/context/row-expand";
import { RowNumberCell } from "./row-number-cell";
import classes from "@/ee/base/styles/grid.module.css";

type GridCellProps = {
  cell: Cell<IBaseRow, unknown>;
  rowIndex: number;
  colIndex?: number;
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  pageId: string;
};

export const GridCell = memo(function GridCell({
  cell,
  rowIndex,
  colIndex,
  onCellUpdate,
  pageId,
}: GridCellProps) {
  const property = cell.column.columnDef.meta?.property;
  const isRowNumber = cell.column.id === "__row_number";
  const isPinned = cell.column.getIsPinned();
  const pinOffset = isPinned ? cell.column.getStart("left") : undefined;

  const [editingCell, setEditingCell] = useAtom(editingCellAtomFamily(pageId)) as unknown as [EditingCell, (val: EditingCell) => void];
  const [activeFormulaEditor, setActiveFormulaEditor] = useAtom(
    activeFormulaEditorAtomFamily(pageId),
  ) as unknown as [FormulaEditorTarget, (val: FormulaEditorTarget) => void];

  const setFocusedCell = useSetAtom(focusedCellAtomFamily(pageId) as PrimitiveAtom<FocusedCell>);
  const isFocused = useAtomValue(
    useMemo(
      () =>
        selectAtom(
          focusedCellAtomFamily(pageId),
          (fc) => fc?.rowId === cell.row.id && fc?.propertyId === property?.id,
        ),
      [pageId, cell.row.id, property?.id],
    ),
  );

  const { t } = useTranslation();
  const editable = useBaseEditable();
  const readOnly = !editable;
  const onExpandRow = useRowExpand();

  const rowId = cell.row.id;
  const isEditing =
    editingCell?.rowId === rowId &&
    editingCell?.propertyId === property?.id &&
    (editable || property?.type === "file");

  const handleEdit = useCallback(() => {
    if (!property || isRowNumber) return;
    if (property.type === "checkbox") return;
    if (readOnly) {
      // Read-only: only the file cell opens (a download-only popover) so
      // attachments stay reachable.
      if (property.type === "file") {
        flushSync(() => setEditingCell({ rowId, propertyId: property.id }));
      }
      return;
    }
    if (property.type === "formula") {
      setActiveFormulaEditor({ propertyId: property.id, rowId });
      return;
    }
    if (isSystemPropertyType(property.type)) return;
    flushSync(() => setEditingCell({ rowId, propertyId: property.id }));
  }, [property, isRowNumber, rowId, readOnly, setEditingCell, setActiveFormulaEditor]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!property || e.button !== 0) return;
      setFocusedCell({ rowId, propertyId: property.id });
    },
    [property, rowId, setFocusedCell],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!property) return;
      setFocusedCell({ rowId, propertyId: property.id });
      (e.currentTarget.closest('[role="grid"]') as HTMLElement | null)?.focus({
        preventScroll: true,
      });
    },
    [property, rowId, setFocusedCell],
  );

  const cellReadOnly = property
    ? readOnly || isSystemPropertyType(property.type)
    : false;

  const closeFormulaEditor = useCallback(
    () => setActiveFormulaEditor(null),
    [setActiveFormulaEditor],
  );

  const handleValueChange = useCallback(
    (value: unknown) => {
      if (!property) return;
      if (!cellValuesEqual(value, cell.getValue())) {
        onCellUpdate(rowId, property.id, value);
      }
    },
    [property, rowId, cell, onCellUpdate],
  );

  const handleCommit = useCallback(
    (value: unknown) => {
      handleValueChange(value);
      setEditingCell(null);
    },
    [handleValueChange, setEditingCell],
  );

  const handleCancel = useCallback(() => {
    setEditingCell(null);
  }, [setEditingCell]);

  const handleTabNavigate = useCallback(
    (shiftKey: boolean) => {
      if (!property) return;
      const tableInstance = cell.getContext().table;
      const colIds = tableInstance
        .getVisibleLeafColumns()
        .filter((c) => c.id !== "__row_number")
        .map((c) => c.id);
      const rowIds = tableInstance.getRowModel().rows.map((r) => r.id);
      const next = computeNextCell(
        rowIds,
        colIds,
        { rowId, propertyId: property.id },
        0,
        shiftKey ? -1 : 1,
        true,
      );
      if (next) {
        setEditingCell(next);
        setFocusedCell(next);
      }
    },
    [cell, rowId, property, setEditingCell, setFocusedCell],
  );

  if (isRowNumber) {
    return (
      <RowNumberCell
        rowId={rowId}
        rowIndex={rowIndex}
        isPinned={Boolean(isPinned)}
        pinOffset={pinOffset}
        pageId={pageId}
      />
    );
  }

  if (!property) return null;

  const CellComponent = getDescriptor(property.type)?.cellComponent;
  if (!CellComponent) return null;

  const value = cell.getValue();

  const cellInner = (
    <div
      id={`base-cell-${rowId}-${property.id}`}
      role="gridcell"
      aria-colindex={colIndex != null ? colIndex + 1 : undefined}
      aria-readonly={cellReadOnly || undefined}
      className={`${classes.cell} ${isPinned ? classes.cellPinned : ""} ${isEditing ? classes.cellEditing : ""} ${isFocused && !isEditing ? classes.cellFocused : ""} ${property.isPrimary ? classes.primaryCell : ""}`}
      style={
        isPinned
          ? ({ "--pin-offset": `${pinOffset}px` } as React.CSSProperties)
          : undefined
      }
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleEdit}
    >
      <CellComponent
        value={value}
        property={property}
        rowId={rowId}
        isEditing={isEditing}
        readOnly={readOnly}
        onCommit={handleCommit}
        onValueChange={handleValueChange}
        onCancel={handleCancel}
        onTabNavigate={handleTabNavigate}
      />
      {property.isPrimary && onExpandRow && !isEditing && (
        <span className={classes.rowExpandAnchor}>
          <Tooltip label={t("Expand")} position="bottom" openDelay={400}>
            <button
              type="button"
              tabIndex={-1}
              data-base-row-expand=""
              className={classes.rowExpandButton}
              onClick={() => onExpandRow(rowId)}
              onDoubleClick={(e) => e.stopPropagation()}
              aria-label={t("Expand row {{number}}", { number: rowIndex + 1 })}
            >
              <IconArrowsDiagonal size={13} />
            </button>
          </Tooltip>
        </span>
      )}
    </div>
  );

  if (property.type !== "formula") return cellInner;

  const formulaEditorOpen =
    activeFormulaEditor?.propertyId === property.id &&
    activeFormulaEditor?.rowId === rowId;

  return (
    <Popover
      opened={formulaEditorOpen}
      onChange={(o) => {
        if (!o) closeFormulaEditor();
      }}
      position="bottom-start"
      width={460}
      shadow="md"
      withinPortal
      closeOnClickOutside
      closeOnEscape={false}
      trapFocus
    >
      <Popover.Target>{cellInner}</Popover.Target>
      <Popover.Dropdown
        p={0}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            closeFormulaEditor();
          }
        }}
        style={{ maxWidth: "calc(100vw - 32px)" }}
      >
        {formulaEditorOpen && (
          <FormulaPropertyEditor
            property={property}
            pageId={pageId}
            onClose={closeFormulaEditor}
          />
        )}
      </Popover.Dropdown>
    </Popover>
  );
},
gridCellPropsEqual);

// Cell instances are re-created whenever the table data identity changes;
// compare by coordinates + value so unchanged cells skip re-rendering.
function gridCellPropsEqual(prev: GridCellProps, next: GridCellProps) {
  if (
    prev.rowIndex !== next.rowIndex ||
    prev.colIndex !== next.colIndex ||
    prev.pageId !== next.pageId ||
    prev.onCellUpdate !== next.onCellUpdate
  ) {
    return false;
  }
  if (prev.cell === next.cell) return true;
  return (
    prev.cell.row.id === next.cell.row.id &&
    prev.cell.column.id === next.cell.column.id &&
    prev.cell.column.columnDef.meta?.property ===
      next.cell.column.columnDef.meta?.property &&
    cellValuesEqual(prev.cell.getValue(), next.cell.getValue())
  );
}
