import {
  Modal,
  Button,
  Group,
  Text,
  Select,
  Switch,
  Divider,
} from "@mantine/core";
import { exportPage } from "@/features/page/services/page-service.ts";
import { useState } from "react";
import { ExportFormat } from "@/features/page/types/page.types.ts";
import { notifications } from "@mantine/notifications";
import { exportSpace } from "@/features/space/services/space-service";
import { useTranslation } from "react-i18next";

interface ExportModalProps {
  id: string;
  type: "space" | "page";
  open: boolean;
  onClose: () => void;
}

export default function ExportModal({
  id,
  type,
  open,
  onClose,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.Markdown);
  const [includeChildren, setIncludeChildren] = useState<boolean>(false);
  const [includeAttachments, setIncludeAttachments] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const { t } = useTranslation();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (type === "page") {
        await exportPage({
          pageId: id,
          format,
          includeChildren,
          includeAttachments,
        });
      }
      if (type === "space") {
        await exportSpace({ spaceId: id, format, includeAttachments });
      }
      notifications.show({
        message: t("Export successful"),
      });
      onClose();
    } catch (err) {
      notifications.show({
        message: "Export failed:" + err.response?.data.message,
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
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text size="md">{t("Format")}</Text>
            </div>
            <ExportFormatSelection format={format} onChange={handleChange} />
          </Group>

          {type === "page" && (
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
            <Button onClick={handleExport} loading={isExporting}>{t("Export")}</Button>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

interface ExportFormatSelection {
  format: ExportFormat;
  onChange: (value: string) => void;
}
function ExportFormatSelection({ format, onChange }: ExportFormatSelection) {
  const { t } = useTranslation();

  return (
    <Select
      data={[
        { value: "markdown", label: "Markdown" },
        { value: "html", label: "HTML" },
      ]}
      defaultValue={format}
      onChange={onChange}
      styles={{ wrapper: { maxWidth: 120 } }}
      comboboxProps={{ width: "120" }}
      allowDeselect={false}
      withCheckIcon={false}
      aria-label={t("Select export format")}
    />
  );
}
