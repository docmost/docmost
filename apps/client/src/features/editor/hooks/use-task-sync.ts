import { useEffect, useRef } from "react";
import { Editor } from "@tiptap/core";
import {
  createTodo,
  updateTodo,
  deleteTodo,
} from "@/features/todo/services/todo-service";
import { useQueryClient } from "@tanstack/react-query";
import { RQ_KEY, SPACE_RQ_KEY } from "@/features/todo/queries/todo-query";

/**
 * Listens to taskItem CustomEvents dispatched by SyncedTaskItem
 * and syncs changes to the todos API + React Query cache.
 */
export function useTaskSync(editor: Editor | null, pageId: string, spaceId?: string) {
  const queryClient = useQueryClient();
  // Track nodeKey → true for API calls in flight to avoid duplicates
  const pendingRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!editor || !pageId) return;

    async function onCreated(e: Event) {
      const { nodeKey, title, checked } = (e as CustomEvent).detail;

      // Avoid double-creating if event fires multiple times before response
      if (pendingRef.current.get(nodeKey)) return;
      pendingRef.current.set(nodeKey, true);

      try {
        const todo = await createTodo({ pageId, title });

        // Write todoId back into the editor node.
        // Primary strategy: match by position (extracted from nodeKey "node:42").
        // Fallback: match by text content in case position shifted.
        const pos = parseInt((nodeKey as string).replace("node:", ""), 10);

        editor?.commands.command(({ tr, state }) => {
          let found = false;

          // 1. Position-based match
          state.doc.descendants((node: any, posN: number) => {
            if (found) return false;
            if (
              node.type.name === "taskItem" &&
              posN === pos &&
              !node.attrs.todoId
            ) {
              tr.setNodeMarkup(posN, undefined, {
                ...node.attrs,
                todoId: todo.id,
                checked,
              });
              found = true;
              return false;
            }
          });
          if (found) return true;

          // 2. Text-based fallback (position may have shifted)
          state.doc.descendants((node: any, posN: number) => {
            if (found) return false;
            if (
              node.type.name === "taskItem" &&
              !node.attrs.todoId &&
              node.textContent.trim() === title
            ) {
              tr.setNodeMarkup(posN, undefined, {
                ...node.attrs,
                todoId: todo.id,
                checked,
              });
              found = true;
              return false;
            }
          });
          return found;
        });

        // Update React Query cache
        queryClient.invalidateQueries({ queryKey: RQ_KEY(pageId) });
      } catch (err) {
        console.error("Failed to create todo from editor task:", err);
      } finally {
        pendingRef.current.delete(nodeKey);
      }
    }

    async function onToggled(e: Event) {
      const { todoId, completed } = (e as CustomEvent).detail;
      try {
        await updateTodo({ todoId, completed });
        queryClient.invalidateQueries({ queryKey: RQ_KEY(pageId) });
        if (spaceId) queryClient.invalidateQueries({ queryKey: SPACE_RQ_KEY(spaceId) });
      } catch (err) {
        console.error("Failed to toggle todo:", err);
      }
    }

    async function onRenamed(e: Event) {
      const { todoId, title } = (e as CustomEvent).detail;
      try {
        await updateTodo({ todoId, title });
        queryClient.invalidateQueries({ queryKey: RQ_KEY(pageId) });
        if (spaceId) queryClient.invalidateQueries({ queryKey: SPACE_RQ_KEY(spaceId) });
      } catch (err) {
        console.error("Failed to rename todo:", err);
      }
    }

    async function onDeleted(e: Event) {
      const { todoId } = (e as CustomEvent).detail;
      try {
        await deleteTodo(todoId);
        queryClient.invalidateQueries({ queryKey: RQ_KEY(pageId) });
        if (spaceId) queryClient.invalidateQueries({ queryKey: SPACE_RQ_KEY(spaceId) });
      } catch (err) {
        console.error("Failed to delete todo:", err);
      }
    }

    document.addEventListener("taskitem:created", onCreated);
    document.addEventListener("taskitem:toggled", onToggled);
    document.addEventListener("taskitem:renamed", onRenamed);
    document.addEventListener("taskitem:deleted", onDeleted);

    return () => {
      document.removeEventListener("taskitem:created", onCreated);
      document.removeEventListener("taskitem:toggled", onToggled);
      document.removeEventListener("taskitem:renamed", onRenamed);
      document.removeEventListener("taskitem:deleted", onDeleted);
    };
  }, [editor, pageId, spaceId, queryClient]);
}
