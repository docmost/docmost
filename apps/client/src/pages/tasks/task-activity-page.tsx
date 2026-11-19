import {
  Anchor,
  Button,
  Checkbox,
  Container,
  Group,
  Text,
  Title,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconChecklist,
  IconFileText,
} from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import { DocumentTitle } from "@/components/ui/document-title";
import { EmptyState } from "@/components/ui/empty-state";
import PageListSkeleton from "@/components/ui/page-list-skeleton";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { useTaskActivity } from "@/features/task/task-query";
import classes from "./tasks-page.module.css";

const labels = {
  assigned: "Assigned to me",
  completed: "Completed",
  reopened: "Reopened",
};

export default function TaskActivityPage() {
  const { batchId } = useParams();
  const { t } = useTranslation();
  const query = useTaskActivity(batchId);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const inaccessible =
    isAxiosError(query.error) &&
    [403, 404].includes(query.error.response?.status);
  return (
    <Container size={800} py="xl">
      <DocumentTitle title={t("Task updates")} />
      <Anchor component={Link} to="/tasks" size="sm" c="dimmed">
        <Group component="span" gap={4}>
          <IconArrowLeft size={14} />
          {t("My tasks")}
        </Group>
      </Anchor>
      <Title order={1} size="h3" mt="sm" mb="lg">
        {t("Task updates")}
      </Title>
      {query.isPending ? (
        <PageListSkeleton />
      ) : query.isError ? (
        <EmptyState
          icon={IconChecklist}
          title={
            inaccessible
              ? t("These task updates are no longer available.")
              : t("Could not load task updates")
          }
          action={
            inaccessible ? undefined : (
              <Button variant="default" onClick={() => query.refetch()}>
                {t("Try again")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className={classes.list}>
            {items.map((item) => (
              <li key={item.taskId} className={classes.row}>
                <Checkbox.Indicator
                  checked={item.checked}
                  size="sm"
                  color="dark"
                  aria-hidden="true"
                />
                <Link
                  className={classes.source}
                  to={buildPageUrl(
                    item.spaceSlug,
                    item.pageSlugId,
                    item.pageTitle,
                    item.blockId,
                  )}
                >
                  <Text
                    component="span"
                    size="sm"
                    fw={500}
                    className={classes.title}
                  >
                    {item.title || t("Untitled task")}
                  </Text>
                  <span className={classes.context}>
                    <IconFileText size={14} aria-hidden="true" />
                    <Text component="span" size="xs" truncate>
                      {item.spaceName} /{" "}
                      {getPageTitle(item.pageTitle, false, t)}
                    </Text>
                  </span>
                </Link>
                <Text
                  component="span"
                  size="xs"
                  c="dimmed"
                  className={classes.details}
                >
                  {t(labels[item.kind])}
                </Text>
              </li>
            ))}
          </ul>
          {query.hasNextPage && (
            <Button
              variant="subtle"
              fullWidth
              mt="sm"
              loading={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {t("Load more")}
            </Button>
          )}
        </>
      )}
    </Container>
  );
}
