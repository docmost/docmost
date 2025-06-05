import { useState } from "react";
import { Modal, Stack, ColorPicker, Group, Button } from "@mantine/core";
import { t } from "i18next";

interface PickPageColorModalProps {
  currentColor: string;
  open: boolean;
  onClose: () => void;
  onApply: (color: string) => void;
}

export default function PickPageColorModal({
  currentColor,
  open,
  onClose,
  onApply,
}: PickPageColorModalProps) {
  const [selectedColor, setSelectedColor] = useState(currentColor);

  const handleColorChange = (newColor: string) => {
    setSelectedColor(newColor);
  };

  const applyNewColor = () => {
    onApply(selectedColor);
    onClose();
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
          <Modal.Title fw={500}>{t("Pick a page color")}</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <Stack>
            <ColorPicker
              format="hex"
              value={selectedColor}
              onChange={handleColorChange}
              swatches={[
                "#25262b",
                "#868e96",
                "#fa5252",
                "#e64980",
                "#be4bdb",
                "#7950f2",
                "#4c6ef5",
                "#228be6",
                "#15aabf",
                "#12b886",
                "#40c057",
                "#82c91e",
                "#fab005",
                "#fd7e14",
              ]}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={onClose}>
                {t("Cancel")}
              </Button>
              <Button onClick={applyNewColor}>{t("Apply")}</Button>
            </Group>
          </Stack>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
