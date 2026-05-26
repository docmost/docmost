import { Alert, Stack, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { CrEvent } from "../types/cr.types";

interface CRCommentsThreadProps {
  events: CrEvent[];
}

/**
 * Shows transition reasons as a read-only discussion thread.
 * No dedicated comment endpoint exists for CRs — this is a placeholder
 * until a proper comment feature is added to the CR backend.
 */
export function CRCommentsThread({ events }: CRCommentsThreadProps) {
  const { t } = useTranslation();

  const notes = events.filter((ev) => ev.reason?.trim());

  return (
    <Stack gap="sm">
      <Alert icon={<IconInfoCircle size={14} />} color="gray" variant="light" p="xs">
        <Text size="xs" c="dimmed">
          {t("Transition notes only. Free-form comments are not yet supported.")}
        </Text>
      </Alert>

      {notes.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("No notes")}
        </Text>
      ) : (
        notes.map((ev) => (
          <Stack key={ev.id} gap={2} pl="sm" style={{ borderLeft: "2px solid var(--mantine-color-gray-3)" }}>
            <Text size="sm">"{ev.reason}"</Text>
            <Text size="xs" c="dimmed">
              {t(ev.to_status)} — {new Date(ev.created_at).toLocaleString()}
            </Text>
          </Stack>
        ))
      )}
    </Stack>
  );
}
