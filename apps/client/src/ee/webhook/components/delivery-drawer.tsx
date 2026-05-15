import { Fragment, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Collapse,
  Drawer,
  Group,
  ScrollArea,
  Skeleton,
  Table,
  Text,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useRedeliverMutation,
  useWebhookDeliveries,
} from "@/ee/webhook/queries/webhook-query";
import { formattedDate } from "@/lib/time";
import NoTableResults from "@/components/common/no-table-results";
import type {
  IWebhookDelivery,
  WebhookDeliveryStatus,
} from "@/ee/webhook/types/webhook.types";

interface DeliveryDrawerProps {
  opened: boolean;
  onClose: () => void;
  webhookId: string | null;
}

function statusColor(status: WebhookDeliveryStatus): string {
  switch (status) {
    case "success":
      return "green";
    case "failed":
      return "red";
    case "pending":
      return "yellow";
    case "skipped_cooldown":
    case "skipped_inflight":
    case "skipped_disabled":
    default:
      return "gray";
  }
}

function statusLabel(status: WebhookDeliveryStatus): string {
  switch (status) {
    case "skipped_cooldown":
      return "skipped (cooldown)";
    case "skipped_inflight":
      return "skipped (in-flight)";
    case "skipped_disabled":
      return "skipped (disabled)";
    default:
      return status;
  }
}

function canRedeliver(status: WebhookDeliveryStatus): boolean {
  return (
    status === "failed" ||
    status === "skipped_cooldown" ||
    status === "skipped_inflight" ||
    status === "skipped_disabled"
  );
}

function DeliveryRow({
  delivery,
  expanded,
  onToggle,
  onRedeliver,
  isRedelivering,
}: {
  delivery: IWebhookDelivery;
  expanded: boolean;
  onToggle: () => void;
  onRedeliver: () => void;
  isRedelivering: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Fragment>
      <Table.Tr style={{ cursor: "pointer" }} onClick={onToggle}>
        <Table.Td>
          <Group gap="xs" wrap="nowrap">
            {expanded ? (
              <IconChevronDown
                size={16}
                color="var(--mantine-color-dimmed)"
              />
            ) : (
              <IconChevronRight
                size={16}
                color="var(--mantine-color-dimmed)"
              />
            )}
            <Text fz="sm" fw={500}>
              {delivery.event}
            </Text>
          </Group>
        </Table.Td>
        <Table.Td>
          <Badge color={statusColor(delivery.status)} variant="light">
            {statusLabel(delivery.status)}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Text fz="sm">
            {delivery.httpStatus ?? "—"}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text fz="sm">
            {delivery.durationMs != null ? `${delivery.durationMs} ms` : "—"}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
            {formattedDate(new Date(delivery.createdAt))}
          </Text>
        </Table.Td>
        <Table.Td onClick={(e) => e.stopPropagation()}>
          {canRedeliver(delivery.status) ? (
            <Button
              size="compact-xs"
              variant="default"
              leftSection={<IconRefresh size={12} />}
              onClick={onRedeliver}
              loading={isRedelivering}
            >
              {t("Redeliver")}
            </Button>
          ) : null}
        </Table.Td>
      </Table.Tr>

      <Table.Tr>
        <Table.Td colSpan={6} p={0} style={{ border: "none" }}>
          <Collapse in={expanded}>
            <Box
              px="md"
              py="sm"
              style={{ background: "var(--mantine-color-gray-light)" }}
            >
              <Text fz="xs" fw={600} mb={4}>
                {t("Payload")}
              </Text>
              <Box
                component="pre"
                style={{
                  fontSize: 11,
                  margin: 0,
                  padding: 8,
                  background: "var(--mantine-color-body)",
                  borderRadius: 4,
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {JSON.stringify(delivery.payload, null, 2)}
              </Box>

              {delivery.responseBody && (
                <>
                  <Text fz="xs" fw={600} mt="sm" mb={4}>
                    {t("Response body")}
                  </Text>
                  <Box
                    component="pre"
                    style={{
                      fontSize: 11,
                      margin: 0,
                      padding: 8,
                      background: "var(--mantine-color-body)",
                      borderRadius: 4,
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {delivery.responseBody}
                  </Box>
                </>
              )}

              {delivery.errorMessage && (
                <>
                  <Text fz="xs" fw={600} mt="sm" mb={4} c="red">
                    {t("Error")}
                  </Text>
                  <Text fz="xs" c="red">
                    {delivery.errorMessage}
                  </Text>
                </>
              )}
            </Box>
          </Collapse>
        </Table.Td>
      </Table.Tr>
    </Fragment>
  );
}

export function DeliveryDrawer({
  opened,
  onClose,
  webhookId,
}: DeliveryDrawerProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useWebhookDeliveries(opened ? webhookId : null);
  const redeliverMutation = useRedeliverMutation(webhookId ?? undefined);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRedeliver = async (deliveryId: string) => {
    setPendingId(deliveryId);
    try {
      await redeliverMutation.mutateAsync({ deliveryId });
    } catch (_err) {
      // notification handled inside mutation
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={t("Recent deliveries")}
      position="right"
      size="xl"
    >
      <ScrollArea h="calc(100vh - 80px)">
        <Table verticalSpacing="xs" striped={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Event")}</Table.Th>
              <Table.Th>{t("Status")}</Table.Th>
              <Table.Th>{t("HTTP")}</Table.Th>
              <Table.Th>{t("Duration")}</Table.Th>
              <Table.Th>{t("Timestamp")}</Table.Th>
              <Table.Th aria-label={t("Action")} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <Skeleton height={14} width={120} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={14} width={70} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={14} width={40} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={14} width={60} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={14} width={140} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={14} width={70} />
                  </Table.Td>
                </Table.Tr>
              ))
            ) : data && data.length > 0 ? (
              data.map((delivery) => (
                <DeliveryRow
                  key={delivery.id}
                  delivery={delivery}
                  expanded={expanded.has(delivery.id)}
                  onToggle={() => toggle(delivery.id)}
                  onRedeliver={() => handleRedeliver(delivery.id)}
                  isRedelivering={
                    pendingId === delivery.id && redeliverMutation.isPending
                  }
                />
              ))
            ) : (
              <NoTableResults colSpan={6} text={t("No deliveries yet")} />
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Drawer>
  );
}
