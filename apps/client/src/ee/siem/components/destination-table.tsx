import { ActionIcon, Menu, Switch, Table, Text, Tooltip } from "@mantine/core";
import {
  IconDots,
  IconEdit,
  IconPlugConnected,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { formattedDate, timeAgo } from "@/lib/time.ts";
import { ISiemDestination, SiemDestinationType } from "@/ee/siem/types/siem.types";
import { DestinationStatusBadge } from "./destination-status-badge";

export const DESTINATION_TYPE_LABELS: Record<SiemDestinationType, string> = {
  splunk_hec: "Splunk HEC",
  datadog: "Datadog",
  http: "Generic HTTP",
};

interface DestinationTableProps {
  destinations?: ISiemDestination[];
  isLoading?: boolean;
  onEdit: (destination: ISiemDestination) => void;
  onTest: (destination: ISiemDestination) => void;
  onRetry: (destination: ISiemDestination) => void;
  onDelete: (destination: ISiemDestination) => void;
  onToggle: (destination: ISiemDestination, enabled: boolean) => void;
}

export function DestinationTable({
  destinations,
  isLoading,
  onEdit,
  onTest,
  onRetry,
  onDelete,
  onToggle,
}: DestinationTableProps) {
  const { t } = useTranslation();

  return (
    <Table.ScrollContainer minWidth={760}>
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Name")}</Table.Th>
            <Table.Th>{t("Type")}</Table.Th>
            <Table.Th>{t("Enabled")}</Table.Th>
            <Table.Th>{t("Status")}</Table.Th>
            <Table.Th>{t("Last delivered")}</Table.Th>
            <Table.Th>{t("Last error")}</Table.Th>
            <Table.Th aria-label={t("Actions")} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {destinations && destinations.length > 0 ? (
            destinations.map((destination) => (
              <Table.Tr key={destination.id}>
                <Table.Td>
                  <Text fz="sm" fw={500}>{destination.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text fz="sm">{DESTINATION_TYPE_LABELS[destination.type]}</Text>
                </Table.Td>
                <Table.Td>
                  <Switch
                    size="sm"
                    checked={destination.enabled}
                    onChange={(event) => onToggle(destination, event.currentTarget.checked)}
                    aria-label={t("Enabled")}
                  />
                </Table.Td>
                <Table.Td>
                  <DestinationStatusBadge destination={destination} />
                  {destination.failingSince &&
                    (destination.status === "failing" ||
                      !destination.enabled) && (
                      <Text
                        fz="xs"
                        c="dimmed"
                        mt={4}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {t("Failing since {{time}}", {
                          time: formattedDate(
                            new Date(destination.failingSince),
                          ),
                        })}
                      </Text>
                    )}
                </Table.Td>
                <Table.Td>
                  <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                    {destination.lastDeliveredAt
                      ? timeAgo(new Date(destination.lastDeliveredAt))
                      : t("Never")}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {destination.lastError ? (
                    <Tooltip label={destination.lastError} multiline w={320}>
                      <Text fz="xs" c="red" lineClamp={2} style={{ maxWidth: 260 }}>
                        {destination.lastError}
                      </Text>
                    </Tooltip>
                  ) : (
                    <Text fz="xs" c="dimmed">—</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Menu shadow="md" width={200}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label={t("Actions")}>
                        <IconDots size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => onEdit(destination)}>
                        {t("Edit")}
                      </Menu.Item>
                      <Menu.Item leftSection={<IconPlugConnected size={16} />} onClick={() => onTest(destination)}>
                        {t("Send test event")}
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconRefresh size={16} />}
                        onClick={() => onRetry(destination)}
                        disabled={!destination.nextAttemptAt}
                      >
                        {t("Retry now")}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => onDelete(destination)}>
                        {t("Delete")}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))
          ) : (
            !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text fz="sm" c="dimmed" ta="center" py="md">
                    {t("No destinations yet")}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
