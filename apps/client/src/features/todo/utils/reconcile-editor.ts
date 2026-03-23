import { Editor } from "@tiptap/core";
import { ITodo } from "@/features/todo/types/todo.types";

/**
 * Compares each taskItem node's checked state against the API todo state
 * and updates any mismatches. Uses skipTodoSync to avoid triggering API
 * calls from the editor's sync plugin.
 */
export function reconcileEditorTodos(editor: Editor, todos: ITodo[]) {
  const todoMap = new Map(todos.map((t) => [t.id, t.completed]));
  editor.commands.command(({ tr, state }) => {
    let hasChanges = false;
    state.doc.descendants((node: any, pos: number) => {
      if (node.type.name !== "taskItem" || !node.attrs.todoId) return;
      const completed = todoMap.get(node.attrs.todoId);
      if (completed !== undefined && node.attrs.checked !== completed) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: completed });
        hasChanges = true;
      }
    });
    if (hasChanges) tr.setMeta("skipTodoSync", true);
    return hasChanges;
  });
}
