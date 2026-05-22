import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TableMap } from "@tiptap/pm/tables";

type Scope =
  | { kind: "col"; index: number }
  | { kind: "row"; index: number }
  | { kind: "cell"; cellPos: number };

export function useTableClear(
  editor: Editor,
  tableNode: ProseMirrorNode,
  tablePos: number,
  scope: Scope,
) {
  return useCallback(() => {
    const tr = editor.state.tr;
    const tableStart = tablePos + 1;
    const map = TableMap.get(tableNode);
    const paragraph = editor.schema.nodes.paragraph;
    if (!paragraph) return;

    const cellOffsets: number[] = [];

    if (scope.kind === "col") {
      for (let row = 0; row < map.height; row++) {
        cellOffsets.push(map.map[row * map.width + scope.index]);
      }
    } else if (scope.kind === "row") {
      for (let col = 0; col < map.width; col++) {
        cellOffsets.push(map.map[scope.index * map.width + col]);
      }
    }

    const targets =
      scope.kind === "cell"
        ? [scope.cellPos]
        : Array.from(new Set(cellOffsets)).map((o) => tableStart + o);

    // Process in reverse position order so earlier replacements don't shift later ones.
    targets.sort((a, b) => b - a);

    for (const cellPos of targets) {
      const node = tr.doc.nodeAt(cellPos);
      if (!node) continue;
      const start = cellPos + 1;
      const end = cellPos + node.nodeSize - 1;
      tr.replaceWith(start, end, paragraph.create());
    }

    if (tr.docChanged) editor.view.dispatch(tr);
  }, [editor, tableNode, tablePos, scope]);
}
