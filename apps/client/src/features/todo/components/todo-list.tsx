import {
  Box,
  Button,
  Divider,
  Group,
  Loader,
  ScrollArea,
  Text,
  TextInput,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import {
  useTodosQuery,
  useCreateTodoMutation,
} from "@/features/todo/queries/todo-query";
import TodoItem from "@/features/todo/components/todo-item";
import { useTranslation } from "react-i18next";

interface TodoListProps {
  pageId: string;
  canEdit: boolean;
}

export default function TodoList({ pageId, canEdit }: TodoListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useTodosQuery({ pageId });
  const createTodoMutation = useCreateTodoMutation();

  const [newTitle, setNewTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  async function handleCreate() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    await createTodoMutation.mutateAsync({ pageId, title: trimmed });
    setNewTitle("");
    setIsAdding(false);
  }

  const todos = data?.items ?? [];
  const open = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  if (isLoading) {
    return (
      <Box p="md">
        <Loader size="sm" />
      </Box>
    );
  }

  return (
    <ScrollArea style={{ height: "85vh" }} scrollbarSize={5} type="scroll">
      <Box pb={200}>
        {todos.length === 0 && !isAdding && (
          <Text size="sm" c="dimmed" mb="sm">
            {t("No todos yet")}
          </Text>
        )}

        {open.length > 0 && (
          <Box mb="xs">
            {open.map((todo) => (
              <TodoItem key={todo.id} todo={todo} canEdit={canEdit} />
            ))}
          </Box>
        )}

        {done.length > 0 && (
          <>
            {open.length > 0 && <Divider my="xs" />}
            <Text size="xs" c="dimmed" mb={4}>
              {t("Completed")} ({done.length})
            </Text>
            {done.map((todo) => (
              <TodoItem key={todo.id} todo={todo} canEdit={canEdit} />
            ))}
          </>
        )}

        {canEdit && (
          <Box mt="sm">
            {isAdding ? (
              <Group gap="xs">
                <TextInput
                  placeholder={t("Todo title")}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setNewTitle("");
                      setIsAdding(false);
                    }
                  }}
                  size="xs"
                  style={{ flex: 1 }}
                  autoFocus
                />
                <Button
                  size="xs"
                  onClick={handleCreate}
                  loading={createTodoMutation.isPending}
                >
                  {t("Add")}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => {
                    setNewTitle("");
                    setIsAdding(false);
                  }}
                >
                  {t("Cancel")}
                </Button>
              </Group>
            ) : (
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => setIsAdding(true)}
              >
                {t("Add todo")}
              </Button>
            )}
          </Box>
        )}
      </Box>
    </ScrollArea>
  );
}
