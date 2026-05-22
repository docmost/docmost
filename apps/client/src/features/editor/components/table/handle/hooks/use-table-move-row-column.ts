import { useCallback, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TableMap } from "@tiptap/pm/tables";
import { moveColumn, moveRow } from "@docmost/editor-ext";

export type MoveDirection = "left" | "right" | "up" | "down";

export function useTableMoveRowColumn(
  editor: Editor,
  orientation: "col" | "row",
  index: number,
  direction: MoveDirection,
  tableNode: ProseMirrorNode,
  tablePos: number,
) {
  const target =
    direction === "left" || direction === "up" ? index - 1 : index + 1;

  const maxIndex = useMemo(() => {
    const map = TableMap.get(tableNode);
    return orientation === "col" ? map.width - 1 : map.height - 1;
  }, [tableNode, orientation]);

  const canMove = target >= 0 && target <= maxIndex;

  const handleMove = useCallback(() => {
    if (!canMove) return;
    const tr = editor.state.tr;
    const moved =
      orientation === "col"
        ? moveColumn({
            tr,
            originIndex: index,
            targetIndex: target,
            select: true,
            pos: tablePos + 1,
          })
        : moveRow({
            tr,
            originIndex: index,
            targetIndex: target,
            select: true,
            pos: tablePos + 1,
          });
    if (moved) editor.view.dispatch(tr);
  }, [editor, orientation, index, target, tablePos, canMove]);

  return { canMove, handleMove };
}
