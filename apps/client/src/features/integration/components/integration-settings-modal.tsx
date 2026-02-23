import { Modal, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Integration } from "../types/integration.types";

type IntegrationSettingsModalProps = {
  integration: Integration | null;
  opened: boolean;
  onClose: () => void;
};

export default function IntegrationSettingsModal({
  integration,
  opened,
  onClose,
}: IntegrationSettingsModalProps) {
  const { t } = useTranslation();

  if (!integration) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`${integration.type.charAt(0).toUpperCase() + integration.type.slice(1)} ${t("Settings")}`}
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t("Integration settings will appear here.")}
        </Text>
      </Stack>
    </Modal>
  );
}
