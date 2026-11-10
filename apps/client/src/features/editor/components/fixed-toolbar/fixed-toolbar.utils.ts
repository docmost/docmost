import type { Editor } from "@tiptap/core";

// List items nest with the list commands, since the indent extension leaves
// them alone; the innermost item picks the list type.
function closestListItem(editor: Editor): "listItem" | "taskItem" | undefined {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const name = $from.node(depth).type.name;
    if (name === "listItem" || name === "taskItem") return name;
  }
  return undefined;
}

export function increaseIndent(editor: Editor): boolean {
  const listItem = closestListItem(editor);
  const chain = editor.chain().focus();
  return (listItem ? chain.sinkListItem(listItem) : chain.indent()).run();
}

export function decreaseIndent(editor: Editor): boolean {
  const listItem = closestListItem(editor);
  const chain = editor.chain().focus();
  return (listItem ? chain.liftListItem(listItem) : chain.outdent()).run();
}
