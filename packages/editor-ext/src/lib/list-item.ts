import type { Editor } from "@tiptap/core";
import {
  ListItem as TiptapListItem,
  TaskItem as TiptapTaskItem,
} from "@tiptap/extension-list";
import type { EditorState } from "@tiptap/pm/state";

// The list item the selection is in, within its table cell. List commands act on it.
export function closestListItem(
  state: EditorState,
): "listItem" | "taskItem" | undefined {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const name = $from.node(depth).type.name;
    if (name === "listItem" || name === "taskItem") return name;
    if (name === "tableCell" || name === "tableHeader") return undefined;
  }
  return undefined;
}

// TipTap's Tab and Shift-Tab move the nearest item of their own type, which can be an
// outer item around a list of the other type, so they only act for the innermost item.
function innermostItemShortcuts(editor: Editor, name: string, nested: boolean) {
  const isInnermost = () => closestListItem(editor.state) === name;
  return {
    ...(nested && {
      Tab: () => isInnermost() && editor.commands.sinkListItem(name),
    }),
    "Shift-Tab": () => isInnermost() && editor.commands.liftListItem(name),
  };
}

export const ListItem = TiptapListItem.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      ...innermostItemShortcuts(this.editor, this.name, true),
    };
  },
});

export const TaskItem = TiptapTaskItem.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      ...innermostItemShortcuts(this.editor, this.name, this.options.nested),
    };
  },
});
