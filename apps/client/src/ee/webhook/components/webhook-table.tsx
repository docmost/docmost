import {
  ActionIcon,
  Anchor,
  Badge,
  Group,
  Menu,
  Skeleton,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconDots,
  IconEdit,
  IconList,
  IconSend,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useDeleteWebhookMutation,
  useSendTestMutation,
} from "@/ee/webhook/queries/webhook-query";
import { formattedDate } from "@/lib/time";
import NoTableResults from "@/components/common/no-table-results";
import type { IWebhook } from "@/ee/webhook/types/webhook.types";

interface WebhookTableProps {
  webhooks: IWebhook[] | undefined;
  isLoading: boolean;
  onEdit: (webhook: IWebhook) => void;
  onViewDeliveries: (webhook: IWebhook) => void;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + "…";
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <Table.Tr key={i}>
          <Table.Td>
            <Skeleton height={14} width={140} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={220} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={70} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={70} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={120} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={24} />
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

export function WebhookTable({
  webhooks,
  isLoading,
  onEdit,
  onViewDeliveries,
}: WebhookTableProps) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteWebhookMutation();
  const sendTestMutation = useSendTestMutation();

  const handleDelete = (webhook: IWebhook) => {
    modals.openConfirmModal({
      title: t("Delete webhook"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to delete the webhook {{name}}? This action cannot be undone.",
            { name: webhook.name },
          )}
        </Text>
      ),
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate({ webhookId: webhook.id });
      },
    });
  };

  return (
    <Table.ScrollContainer minWidth={760}>
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Name")}</Table.Th>
            <Table.Th>{t("URL")}</Table.Th>
            <Table.Th>{t("Events")}</Table.Th>
            <Table.Th>{t("Status")}</Table.Th>
            <Table.Th>{t("Created")}</Table.Th>
            <Table.Th aria-label={t("Action")} />
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {isLoading ? (
            <TableSkeleton />
          ) : webhooks && webhooks.length > 0 ? (
            webhooks.map((webhook) => (
              <Table.Tr key={webhook.id}>
                <Table.Td>
                  <Anchor
                    component="button"
                    type="button"
                    onClick={() => onEdit(webhook)}
                    underline="never"
                    style={{ color: "var(--mantine-color-text)" }}
                  >
                    <Text fz="sm" fw={500} lineClamp={1}>
                      {webhook.name}
                    </Text>
                  </Anchor>
                </Table.Td>

                <Table.Td>
                  <Tooltip label={webhook.url} withArrow position="top-start">
                    <Text fz="sm" c="dimmed" style={{ fontFamily: "monospace" }}>
                      {truncate(webhook.url, 60)}
                    </Text>
                  </Tooltip>
                </Table.Td>

                <Table.Td>
                  <Tooltip
                    label={webhook.subscribedEvents.join(", ")}
                    withArrow
                    multiline
                    w={280}
                  >
                    <Badge variant="light" color="blue">
                      {t("{{count}} events", {
                        count: webhook.subscribedEvents.length,
                      })}
                    </Badge>
                  </Tooltip>
                </Table.Td>

                <Table.Td>
                  <Badge
                    color={webhook.isActive ? "green" : "gray"}
                    variant="light"
                  >
                    {webhook.isActive ? t("Active") : t("Inactive")}
                  </Badge>
                </Table.Td>

                <Table.Td>
                  <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                    {formattedDate(new Date(webhook.createdAt))}
                  </Text>
                </Table.Td>

                <Table.Td>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={t("Webhook menu")}
                      >
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconEdit size={16} />}
                        onClick={() => onEdit(webhook)}
                      >
                        {t("Edit")}
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconSend size={16} />}
                        onClick={() =>
                          sendTestMutation.mutate({ webhookId: webhook.id })
                        }
                      >
                        {t("Send test event")}
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconList size={16} />}
                        onClick={() => onViewDeliveries(webhook)}
                      >
                        {t("View deliveries")}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconTrash size={16} />}
                        color="red"
                        onClick={() => handleDelete(webhook)}
                      >
                        {t("Delete")}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))
          ) : (
            <NoTableResults
              colSpan={6}
              text={t("No webhooks yet. Add one to start receiving events.")}
            />
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
