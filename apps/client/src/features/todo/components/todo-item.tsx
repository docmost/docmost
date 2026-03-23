import { ActionIcon, Checkbox, Group, Text, TextInput } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useHover } from "@mantine/hooks";
import { useState } from "react";
import { ITodo } from "@/features/todo/types/todo.types";
import {
  useDeleteTodoMutation,
  useUpdateTodoMutation,
} from "@/features/todo/queries/todo-query";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";

interface TodoItemProps {
  todo: ITodo;
  canEdit: boolean;
}

export default function TodoItem({ todo, canEdit }: TodoItemProps) {
  const { hovered, ref } = useHover();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [currentUser] = useAtom(currentUserAtom);
  const [editor] = useAtom(pageEditorAtom);

  const updateTodoMutation = useUpdateTodoMutation();
  const deleteTodoMutation = useDeleteTodoMutation(todo.pageId, todo.spaceId);

  const isOwner = currentUser?.user?.id === todo.creatorId;

  async function handleToggle() {
    if (!canEdit) return;
    await updateTodoMutation.mutateAsync({
      todoId: todo.id,
      completed: !todo.completed,
      pageId: todo.pageId,
    });

    // Sync checkbox state back to the corresponding editor node
    editor?.commands.command(({ tr, state }) => {
      let found = false;
      state.doc.descendants((node: any, pos: number) => {
        if (found) return false;
        if (node.type.name === "taskItem" && node.attrs.todoId === todo.id) {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            checked: !todo.completed,
          });
          found = true;
          return false;
        }
      });
      return found;
    });
  }

  async function handleTitleSave() {
    if (title.trim() === "" || title === todo.title) {
      setTitle(todo.title);
      setIsEditing(false);
      return;
    }

    await updateTodoMutation.mutateAsync({
      todoId: todo.id,
      title: title.trim(),
      pageId: todo.pageId,
    });
    setIsEditing(false);
  }

  async function handleDelete() {
    await deleteTodoMutation.mutateAsync(todo.id);

    // Remove the corresponding node from the editor without triggering
    // another API call (skipTodoSync prevents the delete event from firing)
    editor?.commands.command(({ tr, state }) => {
      let targetPos: number | null = null;
      let targetSize: number | null = null;
      state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === "taskItem" && node.attrs.todoId === todo.id) {
          targetPos = pos;
          targetSize = node.nodeSize;
          return false;
        }
      });
      if (targetPos === null) return false;
      tr.setMeta("skipTodoSync", true);
      tr.delete(targetPos, targetPos + targetSize!);
      return true;
    });
  }

  return (
    <Group ref={ref} justify="space-between" wrap="nowrap" py={4}>
      <Group wrap="nowrap" gap="xs" style={{ flex: 1, minWidth: 0 }}>
        <Checkbox
          checked={todo.completed}
          onChange={handleToggle}
          disabled={!canEdit}
          size="sm"
        />

        {isEditing && isOwner ? (
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") {
                setTitle(todo.title);
                setIsEditing(false);
              }
            }}
            size="xs"
            style={{ flex: 1 }}
            autoFocus
          />
        ) : (
          <Text
            size="sm"
            td={todo.completed ? "line-through" : undefined}
            c={todo.completed ? "dimmed" : undefined}
            style={{
              flex: 1,
              cursor: isOwner && canEdit ? "pointer" : "default",
            }}
            onClick={() => {
              if (isOwner && canEdit) setIsEditing(true);
            }}
            lineClamp={2}
          >
            {todo.title}
          </Text>
        )}
      </Group>

      {isOwner && canEdit && (
        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          style={{ visibility: hovered ? "visible" : "hidden" }}
          onClick={handleDelete}
        >
          <IconTrash size={14} />
        </ActionIcon>
      )}
    </Group>
  );
}
