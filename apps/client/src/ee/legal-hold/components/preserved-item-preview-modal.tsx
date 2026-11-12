import "@/features/editor/styles/index.css";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertCircle, IconDownload } from "@tabler/icons-react";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale";
import { formattedDate } from "@/lib/time";
import {
  formatFileSize,
  PRESERVATION_REASON_BADGES,
  PRESERVED_ITEM_TYPE_LABELS,
} from "@/ee/legal-hold/legal-hold.utils";
import { usePreservedItemQuery } from "@/ee/legal-hold/queries/legal-hold-query";
import type {
  PreservedItemDetail,
  PreservedItemType,
  PreservedItemView,
} from "@/ee/legal-hold/types/legal-hold.types";

type PreservedItemPreviewModalProps = {
  opened: boolean;
  onClose: () => void;
  legalHoldId: string;
  item: PreservedItemView | null;
};

export function PreservedItemPreviewModal({
  opened,
  onClose,
  legalHoldId,
  item,
}: PreservedItemPreviewModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="90%"
      title={item ? item.title || t("Untitled") : t("Preview")}
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      {item && <PreviewBody legalHoldId={legalHoldId} item={item} />}
    </Modal>
  );
}

function PreviewBody({
  legalHoldId,
  item,
}: {
  legalHoldId: string;
  item: PreservedItemView;
}) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const query = usePreservedItemQuery(legalHoldId, item.id);
  const reason = PRESERVATION_REASON_BADGES[item.reason];
  const typeLabel = PRESERVED_ITEM_TYPE_LABELS[item.type];
  const meta = [
    typeLabel ? t(typeLabel) : item.type,
    item.spaceName,
    item.actor?.name,
    formattedDate(new Date(item.createdAt)),
  ].filter(Boolean);
  const children = (
    Object.entries(item.childCounts ?? {}) as [PreservedItemType, number][]
  ).filter(([, count]) => count > 0);

  return (
    <Stack gap="md">
      <div>
        <Group gap="xs" wrap="wrap">
          {reason && (
            <Badge variant="light" color={reason.color}>
              {t(reason.label)}
            </Badge>
          )}
          <Text size="sm" c="dimmed">
            {meta.join(" · ")}
          </Text>
        </Group>
        {item.purgeAt && (
          <Text size="sm" c="dimmed" mt={4}>
            {t("Removed on {{date}}", {
              date: formatLocalized(item.purgeAt, "MMM d, yyyy", "PP", locale),
            })}
          </Text>
        )}
      </div>

      {children.length > 0 && (
        <Group gap="xs" wrap="wrap">
          <Text size="sm" c="dimmed">
            {t("Includes")}
          </Text>
          {children.map(([type, count]) => (
            <Badge key={type} variant="default" size="sm">
              {t(PRESERVED_ITEM_TYPE_LABELS[type] ?? type)}: {count}
            </Badge>
          ))}
        </Group>
      )}

      {query.isError ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {getApiErrorMessage(query.error, t("Failed to load preview"))}
        </Alert>
      ) : query.data ? (
        <PreviewContent detail={query.data} />
      ) : (
        <Paper withBorder radius="md" p="lg" aria-busy>
          <Stack gap="sm">
            <Skeleton height={22} width="40%" />
            <Skeleton height={14} />
            <Skeleton height={14} />
            <Skeleton height={14} width="70%" />
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

function PreviewContent({ detail }: { detail: PreservedItemDetail }) {
  const { t } = useTranslation();

  if (detail.type === "attachment") {
    return (
      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" wrap="nowrap">
          <div style={{ minWidth: 0 }}>
            <Text size="sm" fw={500} truncate="end">
              {detail.fileName}
            </Text>
            <Text size="xs" c="dimmed">
              {[formatFileSize(detail.fileSize), detail.mimeType]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </div>
          <Button
            component="a"
            href={`/api/legal-holds/items/${detail.id}/file`}
            download
            variant="default"
            leftSection={<IconDownload size={16} />}
            style={{ flexShrink: 0 }}
          >
            {t("Download")}
          </Button>
        </Group>
      </Paper>
    );
  }

  if (!detail.html) {
    return (
      <Text size="sm" c="dimmed">
        {t("No preview available.")}
      </Text>
    );
  }

  return (
    <Paper withBorder radius="md" py="lg">
      <div
        className="ProseMirror"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.html) }}
      />
    </Paper>
  );
}
