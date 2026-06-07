import { useCallback, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  convertArrayOfRowsToTableNode,
  convertTableNodeToArrayOfRows,
  transpose,
} from "@docmost/editor-ext";
import {
  getCellSortText,
  isCellEmpty,
  isHeaderCell,
  type SortDirection,
  type SortableItem,
  sortItems,
  weaveItems,
} from "../lib/sort-cells";

interface Args {
  editor: Editor;
  orientation: "col" | "row";
  index: number;
  tableNode: ProseMirrorNode;
  tablePos: number;
  direction: SortDirection;
}

function tableHasMergedCells(tableNode: ProseMirrorNode): boolean {
  for (let r = 0; r < tableNode.childCount; r++) {
    const row = tableNode.child(r);
    for (let c = 0; c < row.childCount; c++) {
      const { colspan = 1, rowspan = 1 } = row.child(c).attrs;
      if (colspan > 1 || rowspan > 1) return true;
    }
  }
  return false;
}

function isAllHeader(cells: (ProseMirrorNode | null)[]): boolean {
  return cells.every((c) => c !== null && isHeaderCell(c));
}

export function useTableSort({
  editor,
  orientation,
  index,
  tableNode,
  tablePos,
  direction,
}: Args) {
  const canSort = useMemo(() => {
    if (tableHasMergedCells(tableNode)) return false;

    const rows = convertTableNodeToArrayOfRows(tableNode);
    const axes = orientation === "col" ? rows : transpose(rows);
    if (axes.length < 2) return false;

    return axes.some((cells) => {
      if (isAllHeader(cells)) return false;
      const sortCell = cells[index];
      return !!sortCell && !isCellEmpty(sortCell);
    });
  }, [tableNode, orientation, index]);

  const handleSort = useCallback(() => {
    if (!canSort) return;

    const rows = convertTableNodeToArrayOfRows(tableNode);
    const axes = orientation === "col" ? rows : transpose(rows);

    const items: SortableItem<(ProseMirrorNode | null)[]>[] = axes.map(
      (cells, originalOrder) => {
        const sortCell = cells[index];
        return {
          payload: cells,
          text: sortCell ? getCellSortText(sortCell) : "",
          isHeader: isAllHeader(cells),
          isEmpty: !sortCell || isCellEmpty(sortCell),
          originalOrder,
        };
      },
    );

    const dataItems = items.filter((it) => !it.isHeader);
    const sortedData = sortItems(dataItems, direction);
    const woven = weaveItems(items, sortedData);

    const newAxes = woven.map((it) => it.payload);
    const newRows = orientation === "col" ? newAxes : transpose(newAxes);

    const newTable = convertArrayOfRowsToTableNode(tableNode, newRows);

    const tr = editor.state.tr;
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

    if (tr.docChanged) editor.view.dispatch(tr);
  }, [editor, tableNode, tablePos, orientation, index, direction, canSort]);

  return { canSort, handleSort };
}
