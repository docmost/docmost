import { TaskItem } from "@tiptap/extension-list";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { isChangeOrigin } from "@tiptap/extension-collaboration";

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

        /**
         * When a taskItem is split (Enter key), TipTap copies all attributes –
         * including todoId – to the new node. This causes two nodes to share the
         * same todoId. Detect duplicates after every local transaction and clear
         * the todoId from the newer (higher-position) node so it is treated as
         * a fresh item.
         */
        appendTransaction(transactions, _oldState, newState) {
          const hasLocalChange = transactions.some(
            (tr) =>
              tr.docChanged &&
              !isChangeOrigin(tr) &&
              !tr.getMeta("clearDuplicateTodoIds"),
          );
          if (!hasLocalChange) return null;

          // Find taskItems that share a todoId (split artifact)
          const seen = new Map<string, number>(); // todoId → first pos
          const duplicates: { pos: number; attrs: Record<string, any> }[] = [];

          newState.doc.descendants((node: any, pos: number) => {
            if (node.type.name !== "taskItem" || !node.attrs.todoId) return;
            if (seen.has(node.attrs.todoId)) {
              duplicates.push({ pos, attrs: node.attrs });
            } else {
              seen.set(node.attrs.todoId, pos);
            }
          });

          if (!duplicates.length) return null;

          const tr = newState.tr;
          for (const { pos, attrs } of duplicates) {
            tr.setNodeMarkup(pos, undefined, { ...attrs, todoId: null });
          }
          tr.setMeta("clearDuplicateTodoIds", true);
          return tr;
        },

        state: {
          init(_config, state) {
            return collectTaskItems(state.doc);
          },
          apply(tr, prevItems) {
            if (!tr.docChanged) return prevItems;

            // Skip remote Yjs transactions to avoid duplicate API calls
            if (isChangeOrigin(tr)) return collectTaskItems(tr.doc);

            // Skip programmatic changes from the todo panel (e.g. delete write-back)
            if (tr.getMeta("skipTodoSync")) return collectTaskItems(tr.doc);

            const nextItems = collectTaskItems(tr.doc);

            // Quick lookup sets for move/split detection
            const nextTodoIds = new Set(
              Array.from(nextItems.values())
                .map((i) => i.todoId)
                .filter(Boolean),
            );
            const prevTodoIds = new Set(
              Array.from(prevItems.values())
                .map((i) => i.todoId)
                .filter(Boolean),
            );

            // Deleted: position gone and todoId not found anywhere in next doc
            for (const [id, prev] of prevItems) {
              if (!nextItems.has(id) && prev.todoId) {
                if (!nextTodoIds.has(prev.todoId)) {
                  dispatch("taskitem:deleted", { todoId: prev.todoId });
                }
                // else: item moved to a different position, skip
              }
            }

            for (const [id, next] of nextItems) {
              const prev = prevItems.get(id);

              if (!prev) {
                // New position in this transaction
                if (next.todoId) {
                  // Has todoId – either moved or split artifact already cleared
                  // by appendTransaction. If todoId existed before at a different
                  // position it's a move; skip creation either way.
                  if (!prevTodoIds.has(next.todoId) && next.text.trim()) {
                    // Genuinely new item that somehow arrived with a todoId
                    // (e.g. collaborative paste) – unusual, but handle gracefully
                  }
                } else if (next.text.trim()) {
                  // Brand-new item with text (e.g. pasted content) → create
                  dispatch("taskitem:created", {
                    nodeKey: id,
                    title: next.text.trim(),
                    checked: next.checked,
                  });
                }
                // else: new empty item (typical after Enter) → wait for typing
              } else if (!prev.todoId && !prev.text.trim() && next.text.trim()) {
                // Same position, item had no text, now has text → create
                dispatch("taskitem:created", {
                  nodeKey: id,
                  title: next.text.trim(),
                  checked: next.checked,
                });
              } else if (prev.todoId && prev.checked !== next.checked) {
                dispatch("taskitem:toggled", {
                  todoId: prev.todoId,
                  completed: next.checked,
                });
              } else if (prev.todoId && prev.text !== next.text) {
                dispatch("taskitem:renamed", {
                  todoId: prev.todoId,
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

/**
 * Collects all taskItem nodes keyed by position.
 * Position-only key stays stable while the user types and also stays stable
 * when todoId is written back – avoiding spurious creation events.
 */
function collectTaskItems(doc: any): Map<string, TaskItemInfo> {
  const map = new Map<string, TaskItemInfo>();

  doc.descendants((node: any, pos: number) => {
    if (node.type.name !== "taskItem") return;

    const todoId: string | null = node.attrs.todoId ?? null;
    const checked: boolean = node.attrs.checked ?? false;
    // Use direct text only (exclude nested taskList children) so that typing
    // in a subtask doesn't appear as a text change of the parent task.
    const text: string = getDirectText(node);

    map.set(`node:${pos}`, { pos, todoId, checked, text });
  });

  return map;
}

/**
 * Returns the text content of a taskItem node, excluding any nested taskList
 * children. This ensures that subtask text doesn't bleed into the parent's
 * tracked text and trigger spurious rename events.
 */
function getDirectText(taskItemNode: any): string {
  let text = "";
  taskItemNode.forEach((child: any) => {
    if (child.type.name !== "taskList") {
      text += child.textContent;
    }
  });
  return text;
}

function dispatch(eventName: string, detail: Record<string, unknown>) {
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}
