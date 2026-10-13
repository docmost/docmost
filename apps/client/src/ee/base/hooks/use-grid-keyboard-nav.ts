import { useCallback, useEffect, useMemo } from "react";
import { Table } from "@tanstack/react-table";
import {
  IBaseRow,
  IBaseProperty,
  EditingCell,
  FocusedCell,
  CellCoord,
} from "@/ee/base/types/base.types";
import { computeNextCell } from "@/ee/base/utils/grid-cell-nav";

type UseGridKeyboardNavOptions = {
  table: Table<IBaseRow>;
  properties: IBaseProperty[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  focusedCell: FocusedCell;
  setFocusedCell: (cell: FocusedCell) => void;
  editingCell: EditingCell;
  setEditingCell: (cell: EditingCell) => void;
  openEditor: (coord: CellCoord) => void;
  clearCell: (coord: CellCoord) => void;
  beginTypeToEdit: (coord: CellCoord, char: string) => void;
  scrollCellIntoView: (coord: CellCoord, rowIndex: number) => void;
  selectionCount: number;
  clearSelection: () => void;
  deleteSelected: () => void | Promise<void>;
  toggleRowSelection: (rowId: string) => void;
  expandRow: (rowId: string) => void;
  addRow: (afterRowId: string, focusPropertyId: string) => void;
};

const isPrintableKey = (e: KeyboardEvent) =>
  e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

const isTextEntry = (el: Element | null) =>
  !!el &&
  (el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    (el as HTMLElement).isContentEditable);

export function useGridKeyboardNav({
  table,
  properties,
  containerRef,
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
  addRow,
}: UseGridKeyboardNavOptions) {
  const getColIds = useCallback(
    () =>
      table
        .getVisibleLeafColumns()
        .filter((col) => col.id !== "__row_number")
        .map((col) => col.id),
    [table],
  );

  const getNavColIds = useCallback(
    () => table.getVisibleLeafColumns().map((col) => col.id),
    [table],
  );

  const getRowIds = useCallback(
    () => table.getRowModel().rows.map((row) => row.id),
    [table],
  );

  const propertyType = useCallback(
    (propertyId: string) => properties.find((p) => p.id === propertyId)?.type,
    [properties],
  );

  const primaryPropertyId = useMemo(
    () => properties.find((p) => p.isPrimary)?.id,
    [properties],
  );

  const goEditing = useCallback(
    (next: CellCoord) => {
      (document.activeElement as HTMLElement | null)?.blur();
      setEditingCell(next);
      setFocusedCell(next);
      scrollCellIntoView(next, getRowIds().indexOf(next.rowId));
    },
    [setEditingCell, setFocusedCell, scrollCellIntoView, getRowIds],
  );

  const goFocused = useCallback(
    (next: CellCoord) => {
      setFocusedCell(next);
      scrollCellIntoView(next, getRowIds().indexOf(next.rowId));
    },
    [setFocusedCell, scrollCellIntoView, getRowIds],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (editingCell) {
        const inInput = isTextEntry(e.target as Element);
        switch (e.key) {
          case "ArrowUp":
          case "ArrowDown":
          case "ArrowLeft":
          case "ArrowRight": {
            if (inInput) return;
            e.preventDefault();
            const d =
              e.key === "ArrowUp"
                ? [-1, 0]
                : e.key === "ArrowDown"
                  ? [1, 0]
                  : e.key === "ArrowLeft"
                    ? [0, -1]
                    : [0, 1];
            const next = computeNextCell(
              getRowIds(),
              getColIds(),
              editingCell,
              d[0],
              d[1],
              false,
            );
            if (next) goEditing(next);
            break;
          }
          case "Tab": {
            e.preventDefault();
            const next = computeNextCell(
              getRowIds(),
              getColIds(),
              editingCell,
              0,
              e.shiftKey ? -1 : 1,
              true,
            );
            if (next) goEditing(next);
            break;
          }
          case "Enter": {
            e.preventDefault();
            if (e.shiftKey && editingCell.propertyId === primaryPropertyId) {
              (document.activeElement as HTMLElement | null)?.blur();
              setEditingCell(null);
              addRow(editingCell.rowId, editingCell.propertyId);
              break;
            }
            const next = computeNextCell(
              getRowIds(),
              getColIds(),
              editingCell,
              1,
              0,
              false,
            );
            (document.activeElement as HTMLElement | null)?.blur();
            setEditingCell(null);
            if (next) goFocused(next);
            else setFocusedCell(editingCell);
            break;
          }
          case "Escape": {
            e.preventDefault();
            setEditingCell(null);
            setFocusedCell(editingCell);
            break;
          }
        }
        return;
      }

      if (e.target !== containerRef.current) return;

      if (isTextEntry(document.activeElement)) return;

      if (e.key === "Escape") {
        if (selectionCount > 0) {
          e.preventDefault();
          clearSelection();
        } else if (focusedCell) {
          e.preventDefault();
          setFocusedCell(null);
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectionCount > 0) {
          e.preventDefault();
          void deleteSelected();
        } else if (focusedCell) {
          e.preventDefault();
          clearCell(focusedCell);
        }
        return;
      }

      if (!focusedCell) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          {
            const next = computeNextCell(getRowIds(), getNavColIds(), focusedCell, -1, 0, false);
            if (next) goFocused(next);
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          {
            const next = computeNextCell(getRowIds(), getNavColIds(), focusedCell, 1, 0, false);
            if (next) goFocused(next);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          {
            const next = computeNextCell(getRowIds(), getNavColIds(), focusedCell, 0, -1, false);
            if (next) goFocused(next);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          {
            const next = computeNextCell(getRowIds(), getNavColIds(), focusedCell, 0, 1, false);
            if (next) goFocused(next);
          }
          break;
        case "Tab": {
          const next = computeNextCell(
            getRowIds(),
            getNavColIds(),
            focusedCell,
            0,
            e.shiftKey ? -1 : 1,
            true,
          );
          if (next) {
            e.preventDefault();
            goFocused(next);
          }
          break;
        }
        case "Enter":
        case "F2":
          e.preventDefault();
          if (
            e.key === "Enter" &&
            e.shiftKey &&
            focusedCell.propertyId === primaryPropertyId
          ) {
            addRow(focusedCell.rowId, focusedCell.propertyId);
          } else if (focusedCell.propertyId === "__row_number") {
            toggleRowSelection(focusedCell.rowId);
          } else {
            openEditor(focusedCell);
          }
          break;
        default: {
          if (e.key === " ") {
            e.preventDefault();
            if (focusedCell.propertyId === "__row_number") {
              toggleRowSelection(focusedCell.rowId);
            } else if (propertyType(focusedCell.propertyId) === "checkbox") {
              openEditor(focusedCell);
            } else {
              expandRow(focusedCell.rowId);
            }
          } else if (isPrintableKey(e)) {
            e.preventDefault();
            beginTypeToEdit(focusedCell, e.key);
          }
        }
      }
    },
    [
      containerRef,
      editingCell,
      focusedCell,
      getRowIds,
      getColIds,
      getNavColIds,
      goEditing,
      goFocused,
      setEditingCell,
      setFocusedCell,
      openEditor,
      clearCell,
      beginTypeToEdit,
      propertyType,
      selectionCount,
      clearSelection,
      deleteSelected,
      toggleRowSelection,
      expandRow,
      primaryPropertyId,
      addRow,
    ],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, handleKeyDown]);
}
