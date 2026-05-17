import { useMemo } from "react";
import {
  Badge,
  Group,
  Loader,
  Progress,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconAlertCircle, IconCheck, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  ConfluenceImportHistoryItem,
  ConfluenceImportStatus,
} from "@/ee/confluence-import/types/confluence-import.types";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { formattedDate } from "@/lib/time";
import NoTableResults from "@/components/common/no-table-results";
import { useConfluenceImportsQuery } from "@/ee/confluence-import/queries/confluence-import-queries";

const BADGE_STYLES = {
  root: { flexShrink: 0 },
  label: { overflow: "visible" as const },
};

function statusBadge(status: ConfluenceImportStatus, cancelled: boolean) {
  if (cancelled) {
    return (
      <Badge
        color="gray"
        variant="light"
        leftSection={<IconX size={12} />}
        styles={BADGE_STYLES}
      >
        Cancelled
      </Badge>
    );
  }
  if (status === "processing") {
    return (
      <Badge
        color="blue"
        variant="light"
        leftSection={<Loader size={10} />}
        styles={BADGE_STYLES}
      >
        Running
      </Badge>
    );
  }
  if (status === "success") {
    return (
      <Badge
        color="teal"
        variant="light"
        leftSection={<IconCheck size={12} />}
        styles={BADGE_STYLES}
      >
        Completed
      </Badge>
    );
  }
  return (
    <Badge
      color="red"
      variant="light"
      leftSection={<IconAlertCircle size={12} />}
      styles={BADGE_STYLES}
    >
      Failed
    </Badge>
  );
}

function phaseLabel(phase: string | null): string {
  if (!phase) return "—";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function progressValue(item: ConfluenceImportHistoryItem) {
  if (item.status === "success") return 100;
  if (item.totalPages > 0) {
    return Math.min(
      100,
      Math.round((item.importedPages / item.totalPages) * 100),
    );
  }
  return item.status === "processing" ? 5 : 0;
}

function ProgressCell({ item }: { item: ConfluenceImportHistoryItem }) {
  const value = progressValue(item);
  const color =
    item.status === "failed"
      ? "red"
      : item.status === "success"
        ? "teal"
        : "blue";

  return (
    <Stack gap={4}>
      <Progress value={value} color={color} size="xs" animated={item.status === "processing"} />
      <Group gap="xs" wrap="nowrap">
        <Text fz="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {item.importedPages}/{item.totalPages || "?"} pages
        </Text>
        <Text fz="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          · {item.importedSpaces}/{item.totalSpaces || "?"} spaces
        </Text>
        <Text fz="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          · {item.importedUsers}/{item.totalUsers || "?"} users
        </Text>
      </Group>
    </Stack>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <Table.Tr key={i}>
          <Table.Td>
            <Skeleton height={14} width={120} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={180} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={80} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={140} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={120} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={120} />
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

export default function ConfluenceImportHistory() {
  const { t } = useTranslation();
  const { data, isLoading } = useConfluenceImportsQuery();

  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <Table.ScrollContainer minWidth={720}>
      <Table verticalSpacing="xs" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Status")}</Table.Th>
            <Table.Th>{t("Site")}</Table.Th>
            <Table.Th>{t("Phase")}</Table.Th>
            <Table.Th>{t("Progress")}</Table.Th>
            <Table.Th>{t("Started by")}</Table.Th>
            <Table.Th>{t("Started at")}</Table.Th>
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {isLoading ? (
            <TableSkeleton />
          ) : items.length > 0 ? (
            items.map((item) => (
              <Table.Tr key={item.fileTaskId}>
                <Table.Td>
                  {statusBadge(item.status, item.cancelled)}
                  {item.status === "failed" && item.errorMessage && (
                    <Tooltip label={item.errorMessage} multiline w={320}>
                      <Text fz="xs" c="red" lineClamp={1} maw={180}>
                        {item.errorMessage}
                      </Text>
                    </Tooltip>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text fz="sm" lineClamp={1} maw={240}>
                    {item.siteUrl}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text fz="sm">{phaseLabel(item.currentPhase)}</Text>
                </Table.Td>
                <Table.Td>
                  <ProgressCell item={item} />
                </Table.Td>
                <Table.Td>
                  {item.creatorName ? (
                    <Group gap="sm" wrap="nowrap">
                      <CustomAvatar
                        avatarUrl={item.creatorAvatarUrl}
                        name={item.creatorName}
                        size={24}
                      />
                      <Text fz="sm" lineClamp={1}>
                        {item.creatorName}
                      </Text>
                    </Group>
                  ) : (
                    <Text fz="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                    {formattedDate(new Date(item.createdAt))}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))
          ) : (
            <NoTableResults colSpan={6} />
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
