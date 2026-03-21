import {
  Badge,
  Box,
  Checkbox,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Link, useParams } from "react-router-dom";
import { useSpaceTodosQuery, useUpdateTodoMutation } from "@/features/todo/queries/todo-query";
import { buildPageUrl } from "@/features/page/page.utils";
import { ITodo } from "@/features/todo/types/todo.types";
import { useTranslation } from "react-i18next";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";

export default function SpaceTodoBoard() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams<{ spaceSlug: string }>();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  const { data, isLoading } = useSpaceTodosQuery({
    spaceId: space?.id ?? "",
  });

  const updateTodoMutation = useUpdateTodoMutation();

  if (!space) return null;

  if (isLoading) {
    return (
      <Box p="md">
        <Loader size="sm" />
      </Box>
    );
  }

  const todos = data?.items ?? [];
  const open = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  async function handleToggle(todo: ITodo) {
    await updateTodoMutation.mutateAsync({
      todoId: todo.id,
      completed: !todo.completed,
      pageId: todo.pageId,
    });
  }

  function renderTodoRow(todo: ITodo) {
    const pageUrl = todo.page
      ? buildPageUrl(spaceSlug, todo.page.slugId, todo.page.title ?? "")
      : null;

    return (
      <Group key={todo.id} wrap="nowrap" py={6} style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
        <Checkbox
          checked={todo.completed}
          onChange={() => handleToggle(todo)}
          size="sm"
        />
        <Text
          size="sm"
          flex={1}
          td={todo.completed ? "line-through" : undefined}
          c={todo.completed ? "dimmed" : undefined}
        >
          {todo.title}
        </Text>
        {pageUrl && (
          <Text
            size="xs"
            c="blue"
            component={Link}
            to={pageUrl}
            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {todo.page?.title || t("Untitled")}
          </Text>
        )}
      </Group>
    );
  }

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Group justify="space-between" mb="xs">
          <Title order={2}>{t("Todos")}</Title>
          <Group gap="xs">
            <Badge variant="light" color="blue">
              {t("Open")}: {open.length}
            </Badge>
            <Badge variant="light" color="gray">
              {t("Done")}: {done.length}
            </Badge>
          </Group>
        </Group>

        {todos.length === 0 && (
          <Text ta="center" py="xl" c="dimmed">
            {t("No todos in this space")}
          </Text>
        )}

        {open.length > 0 && (
          <Box>
            <Text size="xs" c="dimmed" mb="xs" tt="uppercase" fw={600}>
              {t("Open")} ({open.length})
            </Text>
            {open.map(renderTodoRow)}
          </Box>
        )}

        {done.length > 0 && (
          <Box mt={open.length > 0 ? "md" : 0}>
            <Text size="xs" c="dimmed" mb="xs" tt="uppercase" fw={600}>
              {t("Completed")} ({done.length})
            </Text>
            {done.map(renderTodoRow)}
          </Box>
        )}
      </Stack>
    </Container>
  );
}
