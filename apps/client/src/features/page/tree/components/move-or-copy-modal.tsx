import { Modal, Button, Group, Text, Stack, Radio } from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export type onMoveActions = "move" | "copy" | "sync";

interface MoveOrCopyModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (action: onMoveActions) => void;
  dragNodeLabel: string;
}

export function MoveOrCopyModal({
  opened,
  onClose,
  onConfirm,
  dragNodeLabel,
}: MoveOrCopyModalProps) {
  const { t } = useTranslation();
  const [action, setAction] = useState<onMoveActions>("move");

  return (
    <Modal.Root
      opened={opened}
      onClose={onClose}
      size="md"
      centered
      padding="xl"
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header py={0}>
          <Modal.Title>
            <Text fw={500} lineClamp={1}>
              {t("Choose Action")}
            </Text>
          </Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <Text mb="sm">
            {t(
              "Would you like to move, copy this page or create a synced version in the new location?",
            )}
          </Text>
          <Text size="sm" c="dimmed" mb="sm">
            {t(
              "Copy creates a standalone copy. Sync keeps the content updated automatically.",
            )}
          </Text>
          <Text fw={700} mb="md">
            {dragNodeLabel}
          </Text>

          <Radio.Group
            value={action}
            onChange={(value: onMoveActions) => setAction(value)}
            label={t("Choose an action")}
            mb="md"
          >
            <Stack gap="xs" mt="xs">
              <Radio value="move" label={t("Move")} />
              <Radio value="copy" label={t("Copy")} />
              <Radio value="sync" label={t("Create Sync")} />
            </Stack>
          </Radio.Group>

          <Group justify="flex-end" mt="lg">
            <Button variant="default" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button onClick={() => onConfirm(action)}>{t("Apply")}</Button>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
