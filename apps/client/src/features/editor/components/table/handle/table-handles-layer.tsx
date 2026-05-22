import React from "react";
import type { Editor } from "@tiptap/react";
import { useTableHandleState } from "./hooks/use-table-handle-state";
import { ColumnHandle } from "./column-handle";
import { RowHandle } from "./row-handle";
import { CellChevron } from "./cell-chevron";

interface TableHandlesLayerProps {
  editor: Editor | null;
}

export const TableHandlesLayer = React.memo(function TableHandlesLayer({
  editor,
}: TableHandlesLayerProps) {
  const state = useTableHandleState(editor);

  if (!editor || !editor.isEditable) return null;
  if (!state.hoveringCell || !state.tableNode || state.tablePos == null) return null;

  return (
    <>
      <ColumnHandle
        editor={editor}
        index={state.hoveringCell.colIndex}
        anchorPos={state.hoveringCell.colFirstCellPos}
        tableNode={state.tableNode!}
        tablePos={state.tablePos!}
      />
      <RowHandle
        editor={editor}
        index={state.hoveringCell.rowIndex}
        anchorPos={state.hoveringCell.rowFirstCellPos}
        tableNode={state.tableNode!}
        tablePos={state.tablePos!}
      />
      <CellChevron
        editor={editor}
        cellPos={state.hoveringCell.cellPos}
        tableNode={state.tableNode!}
        tablePos={state.tablePos!}
      />
    </>
  );
});
