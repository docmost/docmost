import { TaskItem } from "@tiptap/extension-list";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const syncPluginKey = new PluginKey("taskItemSync");

/**
 * Extended TaskItem that adds a todoId attribute.
 * Changes (create, toggle, delete) are dispatched as CustomEvents
 * so the page editor can sync them with the todos API.
 */
export const SyncedTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      todoId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-todo-id") || null,
        renderHTML: (attributes) =>
          attributes.todoId ? { "data-todo-id": attributes.todoId } : {},
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: syncPluginKey,
        state: {
          init(_config, state) {
            return collectTaskItems(state.doc);
          },
          apply(tr, prevItems) {
            if (!tr.docChanged) return prevItems;
            const nextItems = collectTaskItems(tr.doc);

            // Deleted: had todoId before, gone now
            for (const [id, prev] of prevItems) {
              if (!nextItems.has(id) && prev.todoId) {
                dispatch("taskitem:deleted", { todoId: prev.todoId });
              }
            }

            for (const [id, next] of nextItems) {
              const prev = prevItems.get(id);

              if (!prev) {
                // New task item
                dispatch("taskitem:created", {
                  nodeKey: id,
                  title: next.text,
                  checked: next.checked,
                });
              } else if (prev.checked !== next.checked && next.todoId) {
                // Toggled
                dispatch("taskitem:toggled", {
                  todoId: next.todoId,
                  completed: next.checked,
                });
              } else if (prev.text !== next.text && next.todoId) {
                // Title changed
                dispatch("taskitem:renamed", {
                  todoId: next.todoId,
                  title: next.text,
                });
              }
            }

            return nextItems;
          },
        },
      }),
    ];
  },
});

// ── helpers ──────────────────────────────────────────────────────────────────

interface TaskItemInfo {
  pos: number;
  todoId: string | null;
  checked: boolean;
  text: string;
}

/** Collects all taskItem nodes keyed by a stable identity string. */
function collectTaskItems(doc: any): Map<string, TaskItemInfo> {
  const map = new Map<string, TaskItemInfo>();

  doc.descendants((node: any, pos: number) => {
    if (node.type.name !== "taskItem") return;

    const todoId: string | null = node.attrs.todoId ?? null;
    const checked: boolean = node.attrs.checked ?? false;
    const text: string = node.textContent ?? "";

    // Use todoId as key if present, otherwise fall back to position-text combo
    const key = todoId ?? `new:${pos}:${text}`;
    map.set(key, { pos, todoId, checked, text });
  });

  return map;
}

function dispatch(eventName: string, detail: Record<string, unknown>) {
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}
