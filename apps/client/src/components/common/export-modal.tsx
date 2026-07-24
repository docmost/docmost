import {
  Modal,
  Button,
  Group,
  Text,
  Select,
  Switch,
  Divider,
  Tooltip,
  Badge,
  Alert,
} from "@mantine/core";
import {
  exportPage,
  exportPageToDocx,
} from "@/features/page/services/page-service.ts";
import { useState, useEffect } from "react";
import { ExportFormat } from "@/features/page/types/page.types.ts";
import { notifications } from "@mantine/notifications";
import { exportSpace } from "@/features/space/services/space-service";
import { useTranslation } from "react-i18next";
import { Feature } from "@/ee/features";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";
import { usePageKey } from "@/features/encryption/hooks/page-key-store";

interface ExportModalProps {
  id: string;
  type: "space" | "page";
  open: boolean;
  onClose: () => void;
  /** E2E-encrypted page: export happens client-side and needs the page DEK */
  pageIsEncrypted?: boolean;
  pageTitle?: string;
}

export default function ExportModal({
  id,
  type,
  open,
  onClose,
  pageIsEncrypted,
  pageTitle,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.Markdown);
  const [includeChildren, setIncludeChildren] = useState<boolean>(false);
  const [includeAttachments, setIncludeAttachments] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const { t } = useTranslation();
  const upgradeLabel = useUpgradeLabel();
  const isDocx = format === ExportFormat.Docx;
  const docxEntitled = useHasFeature(Feature.DOCX_EXPORT);
  const blockedByLicense = isDocx && !docxEntitled;
  const isEncryptedPage = type === "page" && !!pageIsEncrypted;
  const dek = usePageKey(id);
  const encryptedLocked = isEncryptedPage && !dek;

  // Docx is not offered for encrypted pages; clear a stale selection left over
  // from a previous plaintext export in this same modal instance.
  useEffect(() => {
    if (isEncryptedPage && format === ExportFormat.Docx) {
      setFormat(ExportFormat.Markdown);
    }
  }, [isEncryptedPage, format]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (isEncryptedPage) {
        if (!dek) {
          notifications.show({
            message: t("Unlock this page to export it."),
            color: "yellow",
          });
          return;
        }
        // the server only holds ciphertext — decrypt and serialize locally.
        // Lazy import: keeps the editor extension graph out of this chunk.
        const { exportEncryptedPage } = await import(
          "@/features/encryption/services/encrypted-export"
        );
        await exportEncryptedPage({
          pageId: id,
          title: pageTitle ?? "",
          dek,
          format,
        });
      } else if (type === "page") {
        if (format === ExportFormat.Docx) {
          await exportPageToDocx({ pageId: id });
        } else {
          await exportPage({
            pageId: id,
            format,
            includeChildren,
            includeAttachments,
          });
        }
      } else if (type === "space") {
        await exportSpace({ spaceId: id, format, includeAttachments });
      }
      notifications.show({
        message: t("Export successful"),
      });
      onClose();
    } catch (err) {
      notifications.show({
        message: "Export failed:" + (err.response?.data?.message ?? err.message),
        color: "red",
      });
      console.error("export error", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleChange = (format: ExportFormat) => {
    setFormat(format);
  };

  return (
    <Modal.Root
      opened={open}
      onClose={onClose}
      size={500}
      padding="xl"
      yOffset="10vh"
      xOffset={0}
      mah={400}
      onClick={(e) => e.stopPropagation()}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header py={0}>
          <Modal.Title fw={500}>{t(`Export ${type}`)}</Modal.Title>
          <Modal.CloseButton aria-label={t("Close")} />
        </Modal.Header>
        <Modal.Body>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text size="md">{t("Format")}</Text>
            </div>
            <ExportFormatSelection
              format={format}
              onChange={handleChange}
              includeDocx={type === "page" && !isEncryptedPage}
              docxEntitled={docxEntitled}
            />
          </Group>

          {encryptedLocked && (
            <Alert color="yellow" mt="md">
              {t("Unlock this page to export it.")}
            </Alert>
          )}

          {type === "page" && !isDocx && !isEncryptedPage && (
            <>
              <Divider my="sm" />

              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text size="md">{t("Include subpages")}</Text>
                </div>
                <Switch
                  onChange={(event) =>
                    setIncludeChildren(event.currentTarget.checked)
                  }
                  checked={includeChildren}
                />
              </Group>

              <Group justify="space-between" wrap="nowrap" mt="md">
                <div>
                  <Text size="md">{t("Include attachments")}</Text>
                </div>
                <Switch
                  onChange={(event) =>
                    setIncludeAttachments(event.currentTarget.checked)
                  }
                  checked={includeAttachments}
                />
              </Group>
            </>
          )}

          {type === "space" && (
            <>
              <Divider my="sm" />

              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text size="md">{t("Include attachments")}</Text>
                </div>
                <Switch
                  onChange={(event) =>
                    setIncludeAttachments(event.currentTarget.checked)
                  }
                  checked={includeAttachments}
                />
              </Group>
            </>
          )}

          <Group justify="center" mt="md">
            <Button onClick={onClose} variant="default">
              {t("Cancel")}
            </Button>
            <Tooltip label={upgradeLabel} disabled={!blockedByLicense} withArrow>
              <Button
                onClick={handleExport}
                loading={isExporting}
                disabled={blockedByLicense || encryptedLocked}
                data-disabled={blockedByLicense || encryptedLocked || undefined}
              >
                {t("Export")}
              </Button>
            </Tooltip>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

interface ExportFormatSelection {
  format: ExportFormat;
  onChange: (value: string) => void;
  includeDocx?: boolean;
  docxEntitled?: boolean;
}
function ExportFormatSelection({
  format,
  onChange,
  includeDocx,
  docxEntitled,
}: ExportFormatSelection) {
  const { t } = useTranslation();

  const data = [
    { value: "markdown", label: "Markdown" },
    { value: "html", label: "HTML" },
    ...(includeDocx
      ? [{ value: "docx", label: "Word (.docx)", disabled: !docxEntitled }]
      : []),
  ];

  return (
    <Select
      data={data}
      value={format}
      onChange={onChange}
      styles={{ wrapper: { maxWidth: 140 }, option: { opacity: 1 } }}
      comboboxProps={{ width: 200 }}
      allowDeselect={false}
      withCheckIcon={false}
      aria-label={t("Select export format")}
      renderOption={({ option }) =>
        option.value === "docx" && !docxEntitled ? (
          <div>
            <Text size="sm" c="dimmed">
              {option.label}
            </Text>
            <Badge size="xs" mt={4}>
              {t("Enterprise")}
            </Badge>
          </div>
        ) : (
          <Text size="sm">{option.label}</Text>
        )
      }
    />
  );
}
