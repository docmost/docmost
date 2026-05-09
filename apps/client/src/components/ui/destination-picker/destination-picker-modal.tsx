import { useState, useEffect } from "react";
import { Modal, Button, Group } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { DestinationPicker } from "./destination-picker";
import {
  DestinationPickerModalProps,
  DestinationSelection,
} from "./destination-picker.types";

export function DestinationPickerModal({
  opened,
  onClose,
  title,
  actionLabel,
  onSelect,
  loading,
  excludePageId,
  pageLimit,
}: DestinationPickerModalProps) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<DestinationSelection | null>(null);

  useEffect(() => {
    if (!opened) {
      setSelection(null);
    }
  }, [opened]);

  return (
    <Modal.Root
      opened={opened}
      onClose={onClose}
      size={550}
      padding="lg"
      yOffset="10vh"
      onClick={(e) => e.stopPropagation()}
    >
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header py={0}>
          <Modal.Title fw={500}>{title}</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <DestinationPicker
            onSelectionChange={setSelection}
            excludePageId={excludePageId}
            pageLimit={pageLimit}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t("Close")}
            </Button>
            <Button
              onClick={() => selection && onSelect(selection)}
              disabled={!selection}
              loading={loading}
            >
              {actionLabel}
            </Button>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
