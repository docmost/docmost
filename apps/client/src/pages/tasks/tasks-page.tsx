import { useState } from "react";
import {
  Button,
  Checkbox,
  Container,
  Group,
  SegmentedControl,
  Tabs,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCalendar,
  IconChecklist,
  IconFileText,
  IconPencil,
  IconUser,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatDateLabel } from "@docmost/editor-ext";
import { formatISO } from "date-fns";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import { DocumentTitle } from "@/components/ui/document-title";
import { EmptyState } from "@/components/ui/empty-state";
import PageListSkeleton from "@/components/ui/page-list-skeleton";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import {
  type PageTask,
  type TaskView,
  useSetTaskChecked,
  useTasks,
} from "@/features/task/task-query";
import { useAtomValue } from "jotai";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { Feature } from "@/ee/features";
import { UpgradeAlert } from "@/ee/components/upgrade-alert";
import classes from "./tasks-page.module.css";

function TaskRow({ task, view }: { task: PageTask; view: TaskView }) {
  const { t, i18n } = useTranslation();
  const toggle = useSetTaskChecked();
  const title = task.title || t("Untitled task");
  const person = view === "assigned" ? task.creatorName : task.assigneeName;
  const avatar =
    view === "assigned" ? task.creatorAvatarUrl : task.assigneeAvatarUrl;
  const personLabel =
    view === "assigned"
      ? t("Created by {{name}}", { name: person })
      : t("Assigned to {{name}}", { name: person });
  const date = formatDateLabel(task.dueDate, i18n.resolvedLanguage || "en-US");
  const overdue =
    !task.checked &&
    task.dueDate &&
    task.dueDate < formatISO(new Date(), { representation: "date" });
  return (
    <li className={classes.row}>
      <Tooltip
        label={t("You need edit access to complete this task")}
        disabled={task.canEdit}
      >
        <span className={classes.checkbox}>
          <Checkbox
            size="sm"
            color="dark"
            checked={toggle.isPending ? toggle.variables.checked : task.checked}
            disabled={!task.canEdit || toggle.isPending}
            aria-label={
              task.checked
                ? t("Reopen {{task}}", { task: title })
                : t("Complete {{task}}", { task: title })
            }
            onChange={(event) =>
              toggle.mutate(
                { taskId: task.id, checked: event.currentTarget.checked },
                {
                  onError: () =>
                    notifications.show({
                      color: "red",
                      message: t("Could not update this task. Try again."),
                    }),
                },
              )
            }
          />
        </span>
      </Tooltip>
      <Link
        className={classes.source}
        to={buildPageUrl(
          task.spaceSlug,
          task.pageSlugId,
          task.pageTitle,
          task.blockId,
        )}
      >
        <Text
          component="span"
          size="sm"
          fw={500}
          className={classes.title}
          data-checked={task.checked || undefined}
        >
          {title}
        </Text>
        <span className={classes.context}>
          <IconFileText size={14} aria-hidden="true" />
          <Text component="span" size="xs" truncate>
            {task.spaceName} / {getPageTitle(task.pageTitle, false, t)}
          </Text>
        </span>
      </Link>
      <div className={classes.details}>
        {date && (
          <Tooltip label={t("Due {{date}}", { date })}>
            <time
              className={classes.date}
              data-overdue={overdue || undefined}
              dateTime={task.dueDate}
              aria-label={t("Due {{date}}", { date })}
            >
              <IconCalendar size={14} aria-hidden="true" />
              {date}
            </time>
          </Tooltip>
        )}
        {person ? (
          <Tooltip label={personLabel}>
            <span className={classes.person} aria-label={personLabel}>
              <CustomAvatar
                name={person}
                avatarUrl={avatar}
                type={AvatarIconType.AVATAR}
                size={22}
              />
              <Text
                component="span"
                size="xs"
                c="dimmed"
                truncate
                className={classes.personName}
              >
                {person}
              </Text>
            </span>
          </Tooltip>
        ) : (
          view === "created" && (
            <Text size="xs" c="dimmed">
              {t("Unassigned")}
            </Text>
          )
        )}
      </div>
    </li>
  );
}

export default function TasksPage() {
  const entitlements = useAtomValue(entitlementAtom);
  const { t } = useTranslation();
  if (!entitlements) return <PageListSkeleton />;
  if (!entitlements.features.includes(Feature.TASKS)) {
    return (
      <Container size={800} py="xl">
        <Title order={1} size="h3" mb="lg">
          {t("My tasks")}
        </Title>
        <UpgradeAlert
          message={t("My tasks is included with Docmost Business.")}
        />
      </Container>
    );
  }
  return <TaskList />;
}

function TaskList() {
  const { t } = useTranslation();
  const [view, setView] = useState<TaskView>("assigned");
  const [checked, setChecked] = useState(false);
  const query = useTasks(view, checked);
  const tasks = query.data?.pages.flatMap((page) => page.items) ?? [];
  const content = query.isPending ? (
    <PageListSkeleton />
  ) : query.isError ? (
    <EmptyState
      icon={IconChecklist}
      title={t("Could not load tasks")}
      action={
        <Button variant="default" onClick={() => query.refetch()}>
          {t("Try again")}
        </Button>
      }
    />
  ) : tasks.length ? (
    <>
      <ul className={classes.list}>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} view={view} />
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
  ) : (
    <EmptyState
      icon={IconChecklist}
      title={
        checked
          ? t("No completed tasks")
          : view === "assigned"
            ? t("No tasks assigned to you")
            : t("No open tasks")
      }
      description={
        checked
          ? undefined
          : view === "assigned"
            ? t(
                "Tasks appear here when someone mentions you first in a checklist item.",
              )
            : t("Type [] followed by a space in a page to create a task.")
      }
    />
  );
  return (
    <Container size={800} py="xl">
      <DocumentTitle title={t("My tasks")} />
      <Group justify="space-between" mb="lg" gap="sm">
        <Title order={1} size="h3">
          {t("My tasks")}
        </Title>
        <SegmentedControl
          size="xs"
          aria-label={t("Task status")}
          value={checked ? "completed" : "open"}
          onChange={(value) => setChecked(value === "completed")}
          data={[
            { value: "open", label: t("Open") },
            { value: "completed", label: t("Completed") },
          ]}
        />
      </Group>
      <Tabs
        color="dark"
        value={view}
        onChange={(value) => {
          if (value === "assigned" || value === "created") setView(value);
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="assigned" leftSection={<IconUser size={16} />}>
            {t("Assigned to me")}
          </Tabs.Tab>
          <Tabs.Tab value="created" leftSection={<IconPencil size={16} />}>
            {t("Created by me")}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value={view} pt="xs">
          {content}
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
