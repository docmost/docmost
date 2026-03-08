import { useCallback, useEffect } from "react";
import { Table } from "@tanstack/react-table";
import { IBaseRow, EditingCell } from "@/features/base/types/base.types";

type UseGridKeyboardNavOptions = {
  table: Table<IBaseRow>;
  editingCell: EditingCell;
  setEditingCell: (cell: EditingCell) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export function useGridKeyboardNav({
  table,
  editingCell,
  setEditingCell,
  containerRef,
}: UseGridKeyboardNavOptions) {
  const getNavigableColumns = useCallback(() => {
    return table
      .getVisibleLeafColumns()
      .filter((col) => col.id !== "__row_number")
      .map((col) => col.id);
  }, [table]);

  const getRowIds = useCallback(() => {
    return table.getRowModel().rows.map((row) => row.id);
  }, [table]);

  const navigate = useCallback(
    (rowDelta: number, colDelta: number) => {
      if (!editingCell) return;

      const columns = getNavigableColumns();
      const rowIds = getRowIds();

      const currentColIndex = columns.indexOf(editingCell.propertyId);
      const currentRowIndex = rowIds.indexOf(editingCell.rowId);

      if (currentColIndex === -1 || currentRowIndex === -1) return;

      let nextColIndex = currentColIndex + colDelta;
      let nextRowIndex = currentRowIndex + rowDelta;

      if (nextColIndex < 0) {
        nextColIndex = columns.length - 1;
        nextRowIndex -= 1;
      } else if (nextColIndex >= columns.length) {
        nextColIndex = 0;
        nextRowIndex += 1;
      }

      if (nextRowIndex < 0 || nextRowIndex >= rowIds.length) return;

      setEditingCell({
        rowId: rowIds[nextRowIndex],
        propertyId: columns[nextColIndex],
      });
    },
    [editingCell, getNavigableColumns, getRowIds, setEditingCell],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!editingCell) return;

      const target = e.target as HTMLElement;
      const isInputActive =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      switch (e.key) {
        case "ArrowUp":
          if (!isInputActive) {
            e.preventDefault();
            navigate(-1, 0);
          }
          break;
        case "ArrowDown":
          if (!isInputActive) {
            e.preventDefault();
            navigate(1, 0);
          }
          break;
        case "ArrowLeft":
          if (!isInputActive) {
            e.preventDefault();
            navigate(0, -1);
          }
          break;
        case "ArrowRight":
          if (!isInputActive) {
            e.preventDefault();
            navigate(0, 1);
          }
          break;
        case "Tab":
          e.preventDefault();
          navigate(0, e.shiftKey ? -1 : 1);
          break;
        case "Escape":
          e.preventDefault();
          setEditingCell(null);
          break;
      }
    },
    [editingCell, navigate, setEditingCell],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, handleKeyDown]);
}
