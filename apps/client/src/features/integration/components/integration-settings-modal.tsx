import { Modal, Button, Group, Stack, TextInput, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { Integration, ConnectionStatus } from "../types/integration.types";
import {
  useConnectionStatus,
  useDisconnectIntegration,
} from "../queries/integration-query";
import * as integrationService from "../services/integration-service";

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
  const { data: connectionStatus } = useConnectionStatus(integration?.id);
  const disconnectMutation = useDisconnectIntegration();

  if (!integration) return null;

  const handleConnect = async () => {
    try {
      const result = await integrationService.getOAuthAuthorizeUrl({
        integrationId: integration.id,
      });
      window.location.href = result.authorizationUrl;
    } catch (error) {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to start OAuth connection"),
        color: "red",
      });
    }
  };

  const handleDisconnect = async () => {
    await disconnectMutation.mutateAsync({
      integrationId: integration.id,
    });
  };

  const hasOAuth = true;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`${integration.type.charAt(0).toUpperCase() + integration.type.slice(1)} ${t("Settings")}`}
      size="md"
    >
      <Stack gap="md">
        {hasOAuth && (
          <div>
            <Text size="sm" fw={600} mb="xs">
              {t("Connection")}
            </Text>
            {connectionStatus?.connected ? (
              <Group gap="sm">
                <Text size="sm" c="green">
                  {t("Connected")}
                  {connectionStatus.providerUserId &&
                    ` (${connectionStatus.providerUserId})`}
                </Text>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={handleDisconnect}
                  loading={disconnectMutation.isPending}
                >
                  {t("Disconnect")}
                </Button>
              </Group>
            ) : (
              <Button size="xs" variant="light" onClick={handleConnect}>
                {t("Connect")} {integration.type}
              </Button>
            )}
          </div>
        )}
      </Stack>
    </Modal>
  );
}
