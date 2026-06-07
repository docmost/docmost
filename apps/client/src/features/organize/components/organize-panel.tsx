import {
  Badge,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Timeline,
} from "@mantine/core";
import {
  IconCircleCheck,
  IconCircleX,
  IconClock,
} from "@tabler/icons-react";
import { useOrganizeStream } from "@/features/organize/hooks/use-organize-stream";
import { OrganizeTaskStatus } from "@/features/organize/types/organize.types";

function statusColor(status: string): string {
  switch (status) {
    case "succeeded":
    case "done":
      return "green";
    case "failed":
      return "red";
    case "skipped":
      return "gray";
    default:
      return "blue";
  }
}

function StatusBadge({ status }: { status: OrganizeTaskStatus | string }) {
  return (
    <Badge color={statusColor(status)} variant="light">
      {status}
    </Badge>
  );
}

interface OrganizePanelProps {
  organizeTaskId: string;
}

export function OrganizePanel({ organizeTaskId }: OrganizePanelProps) {
  const { task, events, connected, done } = useOrganizeStream(organizeTaskId);

  if (!task) {
    return (
      <Group gap="xs">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Connecting to organize task…
        </Text>
      </Group>
    );
  }

  const total = task.total ?? 0;
  const completed = task.completed ?? 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : undefined;
  const active = !done && (task.status === "running" || task.status === "open");

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Group gap="xs">
          {active && <Loader size="xs" />}
          <Text fw={500}>{task.title ?? "Organizing"}</Text>
          <StatusBadge status={task.status} />
        </Group>
        <Text size="xs" c="dimmed">
          {connected ? "live" : "reconnecting…"}
        </Text>
      </Group>

      {total > 0 && (
        <div>
          <Progress
            value={percent ?? 0}
            animated={active}
            color={statusColor(task.status)}
          />
          <Text size="xs" c="dimmed" mt={4}>
            {completed} / {total} {percent !== undefined ? `(${percent}%)` : ""}
          </Text>
        </div>
      )}

      {task.error && (
        <Text size="sm" c="red">
          {task.error}
        </Text>
      )}

      {events.length === 0 ? (
        <Text size="sm" c="dimmed">
          Waiting for the agent to report progress…
        </Text>
      ) : (
        <Paper withBorder p="sm" radius="md">
          <Timeline
            active={events.length}
            bulletSize={18}
            lineWidth={2}
            reverseActive
          >
            {events.map((ev) => (
              <Timeline.Item
                key={ev.id}
                bullet={
                  ev.status === "failed" ? (
                    <IconCircleX size={12} />
                  ) : ev.status === "done" ? (
                    <IconCircleCheck size={12} />
                  ) : (
                    <IconClock size={12} />
                  )
                }
                title={
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      {ev.step}
                    </Text>
                    <StatusBadge status={ev.status} />
                  </Group>
                }
              >
                {ev.title && (
                  <Text size="xs" c="dimmed">
                    {ev.title}
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        </Paper>
      )}
    </Stack>
  );
}
