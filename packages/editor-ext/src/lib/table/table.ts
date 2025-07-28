import Table from "@tiptap/extension-table";
import { Editor } from "@tiptap/core";

const LIST_TYPES = ["bulletList", "orderedList", "taskList"];

function isInList(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (LIST_TYPES.includes(node.type.name)) {
      return true;
    }
  }
  
  return false;
}

function handleListIndent(editor: Editor): boolean {
  return editor.commands.sinkListItem("listItem") || 
         editor.commands.sinkListItem("taskItem");
}

function handleListOutdent(editor: Editor): boolean {
  return editor.commands.liftListItem("listItem") || 
         editor.commands.liftListItem("taskItem");
}

export const CustomTable = Table.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: () => {
        // If we're in a list within a table, handle list indentation
        if (isInList(this.editor) && this.editor.isActive("table")) {
          if (handleListIndent(this.editor)) {
            return true;
          }
        }

        // Otherwise, use default table navigation
        if (this.editor.commands.goToNextCell()) {
          return true;
        }

        if (!this.editor.can().addRowAfter()) {
          return false;
        }

        return this.editor.chain().addRowAfter().goToNextCell().run();
      },
      "Shift-Tab": () => {
        // If we're in a list within a table, handle list outdentation
        if (isInList(this.editor) && this.editor.isActive("table")) {
          if (handleListOutdent(this.editor)) {
            return true;
          }
        }

        // Otherwise, use default table navigation
        return this.editor.commands.goToPreviousCell();
      },
    };
  },
});