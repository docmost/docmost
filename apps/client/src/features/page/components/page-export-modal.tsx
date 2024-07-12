import { Modal, Button, Group, Text, Select } from "@mantine/core";
import { exportPage } from "@/features/page/services/page-service.ts";
import { useState } from "react";
import * as React from "react";
import { ExportFormat } from "@/features/page/types/page.types.ts";
import { notifications } from "@mantine/notifications";

interface PageExportModalProps {
  pageId: string;
  open: boolean;
  onClose: () => void;
}

export default function PageExportModal({
  pageId,
  open,
  onClose,
}: PageExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.Markdown);

  const handleExport = async () => {
    try {
      await exportPage({ pageId: pageId, format });
      onClose();
    } catch (err) {
      notifications.show({
        message: "Export failed:" + err.response?.data.message,
        color: "red",
      });
      console.error("export error", err);
    }
  };

  const handleChange = (format: ExportFormat) => {
    setFormat(format);
  };

  return (
    <>
      <Modal
        opened={open}
        onClose={onClose}
        size="350"
        centered
        withCloseButton={false}
      >
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text size="md">Export format</Text>
          </div>
          <ExportFormatSelection onChange={handleChange} />
        </Group>

        <Group justify="flex-start" mt="md">
          <Button onClick={onClose} variant="default">
            Cancel
          </Button>
          <Button onClick={handleExport}>Export</Button>
        </Group>
      </Modal>
    </>
  );
}

interface ExportFormatSelection {
  onChange: (value: string) => void;
}
function ExportFormatSelection({ onChange }: ExportFormatSelection) {
  return (
    <Select
      data={[
        { value: "markdown", label: "Markdown" },
        { value: "html", label: "HTML" },
      ]}
      defaultValue={ExportFormat.Markdown}
      onChange={onChange}
      styles={{ wrapper: { maxWidth: 120 } }}
      comboboxProps={{ width: "120" }}
      allowDeselect={false}
      withCheckIcon={false}
      aria-label="Select export format"
    />
  );
}
