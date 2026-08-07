import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertCircle, IconPlug } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useDisconnectIntegrationMutation,
  useGetIntegrationsQuery,
} from "@/features/integrations/queries/integration-oauth-query";
import { authorizeUrl } from "@/features/integrations/services/integration-oauth-service";
import { IntegrationListItem } from "@/features/integrations/types/integration.types";

export default function IntegrationsList() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useGetIntegrationsQuery();

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle />}>
        {t("Failed to load integrations")}
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Alert color="gray" icon={<IconPlug />}>
        {t(
          "No integrations are configured for this workspace. Ask an administrator to enable one.",
        )}
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      {data.map((integration) => (
        <IntegrationCard key={integration.id} integration={integration} />
      ))}
    </Stack>
  );
}

function IntegrationCard({
  integration,
}: {
  integration: IntegrationListItem;
}) {
  const { t } = useTranslation();
  const disconnect = useDisconnectIntegrationMutation();

  const onConnect = () => {
    // Top-level navigation — provider redirects back into our window.
    window.location.href = authorizeUrl(
      integration.id,
      "/settings/account/integrations",
    );
  };

  const onDisconnect = () => {
    disconnect.mutate({ integrationId: integration.id });
  };

  const connectLabel = t("Connect your {{integration}} account", {
    integration: integration.name,
  });

  return (
    <Card withBorder padding="lg" radius="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap="sm" align="center">
            <Text fw={600}>{integration.name}</Text>
            {integration.connected && !integration.needsReconnect && (
              <Badge color="green" variant="light">
                {t("Connected")}
              </Badge>
            )}
            {integration.needsReconnect && (
              <Badge color="orange" variant="light">
                {t("Reconnect required")}
              </Badge>
            )}
          </Group>
          {integration.description && (
            <Text size="sm" c="dimmed">
              {integration.description}
            </Text>
          )}
          {integration.scopes.length > 0 && (
            <Group gap={4} mt={4}>
              {integration.scopes.map((scope) => (
                <Badge key={scope} variant="default" size="xs">
                  {scope}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
        <Group gap="xs">
          {integration.connected ? (
            <>
              {integration.needsReconnect && (
                <Button onClick={onConnect} variant="filled" color="orange">
                  {t("Reconnect")}
                </Button>
              )}
              <Button
                onClick={onDisconnect}
                variant="default"
                loading={disconnect.isPending}
              >
                {t("Disconnect")}
              </Button>
            </>
          ) : (
            <Button onClick={onConnect}>{connectLabel}</Button>
          )}
        </Group>
      </Group>
    </Card>
  );
}
