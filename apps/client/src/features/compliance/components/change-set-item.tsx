import { Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { IconArrowBackUp, IconTicket } from "@tabler/icons-react";
import { Trans, useTranslation } from "react-i18next";
import { formattedDate } from "@/lib/time.ts";
import { IChangeSet } from "@/features/compliance/types/compliance.types.ts";

interface ChangeSetItemProps {
  changeSet: IChangeSet;
  canEdit?: boolean;
  onCorrect?: (changeSetId: string) => void;
}

export default function ChangeSetItem({
  changeSet,
  canEdit,
  onCorrect,
}: ChangeSetItemProps) {
  const { t } = useTranslation();
  const performedByName = changeSet.performedBy?.name ?? t("Someone");

  return (
    <Paper radius="sm" p="sm" mb="sm" withBorder>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap="xs" wrap="wrap">
          <Badge size="sm" variant="light">
            {changeSet.targetSystem}
          </Badge>
          {changeSet.ticketRef && (
            <Badge
              size="sm"
              variant="light"
              color="gray"
              leftSection={<IconTicket size={12} />}
            >
              {changeSet.ticketRef}
            </Badge>
          )}
          {changeSet.correctsId && (
            <Badge size="sm" variant="light" color="orange">
              {t("Correction")}
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {formattedDate(new Date(changeSet.createdAt))}
        </Text>
      </Group>

      <Stack gap={2} mt="xs">
        {changeSet.entries.map((entry) => (
          <div key={entry.id}>
            <Text size="sm">• {entry.summary}</Text>
            {entry.detail && (
              <Text size="xs" c="dimmed" pl="sm">
                {entry.detail}
              </Text>
            )}
          </div>
        ))}
      </Stack>

      <Text size="xs" c="dimmed" mt="xs">
        {t("Reason")}: {changeSet.reason}
      </Text>
      <Text size="xs" c="dimmed">
        <Trans
          defaults="Requested by <b>{{requestedBy}}</b>, performed by <b>{{performedBy}}</b>"
          values={{
            requestedBy: changeSet.requestedBy,
            performedBy: performedByName,
          }}
          components={{ b: <Text span fw={500} inherit /> }}
        />
      </Text>

      {canEdit && onCorrect && (
        <Group justify="flex-end" mt="xs">
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconArrowBackUp size={14} />}
            onClick={() => onCorrect(changeSet.id)}
          >
            {t("Add correction")}
          </Button>
        </Group>
      )}
    </Paper>
  );
}
