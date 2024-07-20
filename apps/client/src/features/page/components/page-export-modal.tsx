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
    <Modal.Root
      opened={open}
      onClose={onClose}
      size={500}
      padding="xl"
      yOffset="10vh"
      xOffset={0}
      mah={400}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header py={0}>
          <Modal.Title fw={500}>Export page</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text size="md">Format</Text>
            </div>
            <ExportFormatSelection onChange={handleChange} />
          </Group>

          <Group justify="center" mt="md">
            <Button onClick={onClose} variant="default">
              Cancel
            </Button>
            <Button onClick={handleExport}>Export</Button>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
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
