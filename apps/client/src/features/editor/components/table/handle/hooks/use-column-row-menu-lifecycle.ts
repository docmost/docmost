import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { buildRowOrColumnSelection, Orientation } from "../lib/select-row-column";

interface Args {
  editor: Editor;
  orientation: Orientation;
  index: number;
  tableNode: ProseMirrorNode;
  tablePos: number;
}

export function useColumnRowMenuLifecycle({
  editor,
  orientation,
  index,
  tableNode,
  tablePos,
}: Args) {
  const onOpen = useCallback(() => {
    const selection = buildRowOrColumnSelection(
      editor.state,
      tableNode,
      tablePos,
      orientation,
      index,
    );
    const tr = editor.state.tr;
    if (selection) tr.setSelection(selection);
    editor.view.dispatch(tr);
    editor.commands.freezeHandles();
  }, [editor, orientation, index, tableNode, tablePos]);

  const onClose = useCallback(() => {
    editor.commands.unfreezeHandles();
  }, [editor]);

  return { onOpen, onClose };
}
