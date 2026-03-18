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

interface TodoItemProps {
  todoItem: ITodo;
  canEdit: boolean;
}

export default function TodoItem({ todoItem, canEdit }: TodoItemProps) {
  const { hovered, ref } = useHover();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(todoItem.title);
  const [currentUser] = useAtom(currentUserAtom);

  const updateTodoMutation = useUpdateTodoMutation();
  const deleteTodoMutation = useDeleteTodoMutation(todoItem.pageId);

  const isOwner = currentUser?.user?.id === todoItem.creatorId;

  async function handleToggle() {
    if (!canEdit) return;
    await updateTodoMutation.mutateAsync({
      todoId: todoItem.id,
      completed: !todoItem.completed,
      pageId: todoItem.pageId,
    });
  }

  async function handleTitleSave() {
    if (title.trim() === "" || title === todoItem.title) {
      setTitle(todoItem.title);
      setIsEditing(false);
      return;
    }

    await updateTodoMutation.mutateAsync({
      todoId: todoItem.id,
      title: title.trim(),
      pageId: todoItem.pageId,
    });
    setIsEditing(false);
  }

  async function handleDelete() {
    await deleteTodoMutation.mutateAsync(todoItem.id);
  }

  return (
    <Group ref={ref} justify="space-between" wrap="nowrap" py={4}>
      <Group wrap="nowrap" gap="xs" style={{ flex: 1, minWidth: 0 }}>
        <Checkbox
          checked={todoItem.completed}
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
                setTitle(todoItem.title);
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
            td={todoItem.completed ? "line-through" : undefined}
            c={todoItem.completed ? "dimmed" : undefined}
            style={{
              flex: 1,
              cursor: isOwner && canEdit ? "pointer" : "default",
            }}
            onClick={() => {
              if (isOwner && canEdit) setIsEditing(true);
            }}
            lineClamp={2}
          >
            {todoItem.title}
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
