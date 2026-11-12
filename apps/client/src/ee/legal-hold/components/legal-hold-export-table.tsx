import {
  Alert,
  Badge,
  Button,
  Group,
  Skeleton,
  Table,
  Text,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconDownload,
  IconFileExport,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import NoTableResults from "@/components/common/no-table-results";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { getApiErrorMessage } from "@/lib/api-error";
import { formattedDate } from "@/lib/time";
import {
  EXPORT_STATUS_BADGES,
  formatFileSize,
} from "@/ee/legal-hold/legal-hold.utils";
import { useLegalHoldExportsQuery } from "@/ee/legal-hold/queries/legal-hold-query";

type LegalHoldExportTableProps = {
  legalHoldId: string;
  onExport: () => void;
  isExporting: boolean;
};

function TableSkeleton() {
  return (
    <>
      {[0, 1, 2].map((row) => (
        <Table.Tr key={row}>
          <Table.Td>
            <Skeleton height={14} width={150} />
          </Table.Td>
          <Table.Td>
            <Group gap={8} wrap="nowrap">
              <Skeleton height={26} width={26} circle />
              <Skeleton height={14} width={90} />
            </Group>
          </Table.Td>
          <Table.Td>
            <Skeleton height={20} width={80} radius="xl" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={50} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={14} width={150} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={30} width={100} radius="sm" />
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

export function LegalHoldExportTable({
  legalHoldId,
  onExport,
  isExporting,
}: LegalHoldExportTableProps) {
  const { t } = useTranslation();
  const query = useLegalHoldExportsQuery(legalHoldId);
  const legalHoldExports = query.data ?? [];

  return (
    <>
      <Group justify="space-between" align="center" wrap="nowrap" mb="md">
        <Text size="sm" c="dimmed">
          {t(
            "Exports include current and preserved content and stay available for 7 days.",
          )}
        </Text>
        <Button
          variant="default"
          leftSection={<IconFileExport size={16} />}
          onClick={onExport}
          loading={isExporting}
          style={{ flexShrink: 0 }}
        >
          {t("Export")}
        </Button>
      </Group>

      {query.isError && !query.data ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {getApiErrorMessage(query.error, t("Failed to load exports"))}
        </Alert>
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing="sm" aria-busy={query.isLoading}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("Requested")}</Table.Th>
                <Table.Th>{t("By")}</Table.Th>
                <Table.Th>{t("Status")}</Table.Th>
                <Table.Th>{t("Size")}</Table.Th>
                <Table.Th>{t("Expires")}</Table.Th>
                <Table.Th aria-label={t("Actions")} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {query.isLoading ? (
                <TableSkeleton />
              ) : legalHoldExports.length > 0 ? (
                legalHoldExports.map((legalHoldExport) => {
                  const status = EXPORT_STATUS_BADGES[legalHoldExport.status];
                  const downloadLabel = t("Download {{name}}", {
                    name: legalHoldExport.fileName,
                  });
                  return (
                    <Table.Tr key={legalHoldExport.id}>
                      <Table.Td>
                        <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                          {formattedDate(new Date(legalHoldExport.createdAt))}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {legalHoldExport.creator && (
                          <Group gap={8} wrap="nowrap">
                            <CustomAvatar
                              size="sm"
                              avatarUrl={legalHoldExport.creator.avatarUrl}
                              name={legalHoldExport.creator.name}
                            />
                            <Text fz="sm" lineClamp={1}>
                              {legalHoldExport.creator.name}
                            </Text>
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={status?.color ?? "gray"}>
                          {status ? t(status.label) : legalHoldExport.status}
                        </Badge>
                        {legalHoldExport.status === "failed" &&
                          legalHoldExport.errorMessage && (
                            <Text fz="xs" c="dimmed" lineClamp={2} mt={4}>
                              {legalHoldExport.errorMessage}
                            </Text>
                          )}
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                          {formatFileSize(legalHoldExport.fileSize)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                          {legalHoldExport.expiresAt &&
                            formattedDate(new Date(legalHoldExport.expiresAt))}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {legalHoldExport.status === "success" ? (
                          <Button
                            component="a"
                            href={`/api/legal-holds/exports/${legalHoldExport.id}/download`}
                            download
                            size="xs"
                            variant="default"
                            leftSection={<IconDownload size={14} />}
                            aria-label={downloadLabel}
                          >
                            {t("Download")}
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="default"
                            leftSection={<IconDownload size={14} />}
                            aria-label={downloadLabel}
                            disabled
                          >
                            {t("Download")}
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              ) : (
                <NoTableResults colSpan={6} text={t("No exports yet.")} />
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </>
  );
}
