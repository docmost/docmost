import type { Editor } from "@tiptap/react";

export function changeIndent(editor: Editor, direction: "indent" | "outdent") {
  const listItem = editor.isActive("taskItem")
    ? "taskItem"
    : editor.isActive("listItem")
      ? "listItem"
      : null;
  const chain = editor.chain().focus();

  if (listItem) {
    return direction === "indent"
      ? chain.sinkListItem(listItem).run()
      : chain.liftListItem(listItem).run();
  }

  return direction === "indent" ? chain.indent().run() : chain.outdent().run();
}
