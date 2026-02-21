import { useState, useCallback } from "react";
import {
  Group,
  Table,
  Text,
  Badge,
  Button,
  Space,
  Tooltip,
} from "@mantine/core";
import { IconPlayerPlay, IconDownload } from "@tabler/icons-react";
import SettingsTitle from "@/components/settings/settings-title";
import { useTranslation } from "react-i18next";
import { getAppName } from "@/lib/config";
import { Helmet } from "react-helmet-async";
import {
  useBackupJobsQuery,
  useRunBackupMutation,
} from "@/features/backup/queries/backup-query";
import type { BackupJob } from "@/features/backup/services/backup-service";
import Paginate from "@/components/common/paginate";
import NoTableResults from "@/components/common/no-table-results";
import { getBackupDownloadUrl } from "@/features/backup/services/backup-service";

const JOB_STATUS_MAP: Record<
  string,
  { label: string; color: "green" | "yellow" | "red" | "gray" | "blue" }
> = {
  pending: { label: "Pending", color: "gray" },
  running: { label: "Running", color: "blue" },
  success: { label: "Success", color: "green" },
  failed: { label: "Failed", color: "red" },
  canceled: { label: "Canceled", color: "gray" },
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return "—";
  }
}

function formatSize(bytes: string | null): string {
  if (bytes == null || bytes === "") return "—";
  const n = Number(bytes);
  if (Number.isNaN(n) || n === 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTrigger(job: BackupJob): string {
  if (job.triggerType === "manual") {
    return job.triggererName ?? "—";
  }
  return "System";
}

export default function BackupPage() {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);

  const { data, isLoading } = useBackupJobsQuery({ cursor, limit: 20 });
  const runMutation = useRunBackupMutation();

  const goNext = useCallback((nextCursor: string | null | undefined) => {
    if (nextCursor) {
      setCursorStack((prev) => [...prev, cursor]);
      setCursor(nextCursor);
    }
  }, [cursor]);

  const goPrev = useCallback(() => {
    setCursorStack((prev) => {
      const next = prev.slice(0, -1);
      setCursor(prev[prev.length - 1]);
      return next;
    });
  }, []);

  const handleDownload = useCallback(async (jobId: string) => {
    try {
      const { url } = await getBackupDownloadUrl(jobId);
      window.open(url, "_blank");
    } catch {
      // error already handled by api client or show toast
    }
  }, []);

  return (
    <>
      <Helmet>
        <title>{t("Backup & Restore")} - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title={t("Backup & Restore")} />

      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          {t("Trigger a full backup or download a previous backup.")}
        </Text>
        <Button
          leftSection={<IconPlayerPlay size={16} />}
          loading={runMutation.isPending}
          onClick={() => runMutation.mutate()}
        >
          {t("Run backup now")}
        </Button>
      </Group>

      <Space h="md" />

      <Table.ScrollContainer minWidth={700}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Started")}</Table.Th>
              <Table.Th>{t("Ended")}</Table.Th>
              <Table.Th>{t("Size")}</Table.Th>
              <Table.Th>{t("Status")}</Table.Th>
              <Table.Th>{t("Triggered by")}</Table.Th>
              <Table.Th>{t("Actions")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed">
                    {t("Loading...")}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (data?.items?.length ?? 0) > 0 ? (
              (data.items ?? []).map((job) => {
                const statusInfo =
                  JOB_STATUS_MAP[job.status] ?? JOB_STATUS_MAP.pending;
                return (
                  <Table.Tr key={job.id}>
                    <Table.Td>
                      <Text fz="sm">{formatDate(job.startedAt ?? job.createdAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm">{formatDate(job.endedAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm">{formatSize(job.artifactSizeBytes)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={statusInfo.color}>
                        {t(statusInfo.label)}
                      </Badge>
                      {job.status === "failed" && job.errorMessage && (
                        <Tooltip label={job.errorMessage}>
                          <Text fz="xs" c="red" mt={4} lineClamp={1}>
                            {job.errorMessage}
                          </Text>
                        </Tooltip>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm">{formatTrigger(job)}</Text>
                    </Table.Td>
                    <Table.Td>
                      {job.status === "success" && (
                        <Button
                          variant="subtle"
                          size="compact-sm"
                          leftSection={<IconDownload size={14} />}
                          onClick={() => handleDownload(job.id)}
                        >
                          {t("Download")}
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })
            ) : (
              <NoTableResults colSpan={6} />
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {data && (data?.hasNextPage || data?.hasPrevPage) && (
        <Paginate
          hasPrevPage={data.hasPrevPage ?? false}
          hasNextPage={data.hasNextPage ?? false}
          onPrev={goPrev}
          onNext={() => goNext(data?.nextCursor ?? null)}
        />
      )}
    </>
  );
}
