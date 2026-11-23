import { closestListItem } from "@docmost/editor-ext";
import type { Editor } from "@tiptap/core";

// List items nest with the list commands, since the indent extension leaves them alone.
export function increaseIndent(editor: Editor): boolean {
  const listItem = closestListItem(editor.state);
  const chain = editor.chain().focus();
  return (listItem ? chain.sinkListItem(listItem) : chain.indent()).run();
}

export function decreaseIndent(editor: Editor): boolean {
  const listItem = closestListItem(editor.state);
  const chain = editor.chain().focus();
  return (listItem ? chain.liftListItem(listItem) : chain.outdent()).run();
}
