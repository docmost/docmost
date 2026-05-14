import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { CellSelection, TableMap } from "@tiptap/pm/tables";

export type Orientation = "col" | "row";

export function buildRowOrColumnSelection(
  state: EditorState,
  tableNode: ProseMirrorNode,
  tablePos: number,
  orientation: Orientation,
  index: number,
): CellSelection | null {
  const map = TableMap.get(tableNode);
  const tableStart = tablePos + 1;

  if (orientation === "col") {
    if (index < 0 || index >= map.width) return null;
    const firstCellPos = tableStart + map.map[index];
    const lastCellPos =
      tableStart + map.map[(map.height - 1) * map.width + index];
    const $first = state.doc.resolve(firstCellPos);
    const $last = state.doc.resolve(lastCellPos);
    return CellSelection.colSelection($first, $last);
  }

  if (index < 0 || index >= map.height) return null;
  const firstCellPos = tableStart + map.map[index * map.width];
  const lastCellPos =
    tableStart + map.map[index * map.width + (map.width - 1)];
  const $first = state.doc.resolve(firstCellPos);
  const $last = state.doc.resolve(lastCellPos);
  return CellSelection.rowSelection($first, $last);
}
