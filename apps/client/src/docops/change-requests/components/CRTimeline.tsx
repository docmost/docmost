import { Stack, Text, Timeline } from "@mantine/core";
import {
  IconCheck,
  IconCircleOff,
  IconGitBranch,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { CrEvent } from "../types/cr.types";

function eventIcon(toStatus: string) {
  if (toStatus === "PUBLISHED") return <IconCheck size={14} />;
  if (toStatus === "REJECTED" || toStatus === "CANCELLED") return <IconX size={14} />;
  if (toStatus === "CLOSED") return <IconCircleOff size={14} />;
  if (toStatus === "REQUESTED") return <IconSend size={14} />;
  return <IconGitBranch size={14} />;
}

function eventColor(toStatus: string): string {
  if (toStatus === "PUBLISHED") return "green";
  if (toStatus === "REJECTED" || toStatus === "CANCELLED") return "red";
  if (toStatus === "CLOSED") return "dark";
  if (toStatus === "APPROVED") return "teal";
  return "blue";
}

interface CRTimelineProps {
  events: CrEvent[];
}

export function CRTimeline({ events }: CRTimelineProps) {
  const { t } = useTranslation();

  if (events.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t("No events yet")}
      </Text>
    );
  }

  return (
    <Timeline active={events.length - 1} bulletSize={24} lineWidth={2}>
      {events.map((ev) => (
        <Timeline.Item
          key={ev.id}
          bullet={eventIcon(ev.to_status)}
          color={eventColor(ev.to_status)}
          title={
            <Text size="sm" fw={500}>
              {ev.from_status ? `${t(ev.from_status)} → ${t(ev.to_status)}` : t(ev.to_status)}
            </Text>
          }
        >
          <Stack gap={2}>
            {ev.reason && (
              <Text size="xs" c="dimmed" fs="italic">
                "{ev.reason}"
              </Text>
            )}
            <Text size="xs" c="dimmed">
              {new Date(ev.created_at).toLocaleString()}
            </Text>
          </Stack>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
