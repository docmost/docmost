import { Group, Text, Button, Box, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IntegrationDefinition, UserConnection } from "../types/integration.types";
import { getIntegrationIcon } from "./integration-icons";

type ConnectionRowProps = {
  definition: IntegrationDefinition;
  connection?: UserConnection;
  onConnect: (type: string) => void;
  onDisconnect: (integrationId: string) => void;
  disconnectingId?: string;
};

export default function ConnectionRow({
  definition,
  connection,
  onConnect,
  onDisconnect,
  disconnectingId,
}: ConnectionRowProps) {
  const { t } = useTranslation();
  const connectedLabel =
    connection?.providerDisplayName || connection?.providerUserId;

  return (
    <Box
      py="sm"
      px="xs"
      style={{
        borderBottom: "1px solid var(--mantine-color-default-border)",
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          {getIntegrationIcon(definition.type, 28)}
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text size="sm" fw={500}>
              {definition.name}
            </Text>
            {connection?.invalidatedAt ? (
              <Text size="xs" c="orange">
                {t("Connection expired")}
              </Text>
            ) : connection && connectedLabel ? (
              <Text size="xs" c="dimmed" truncate>
                {t("Connected as {{label}}", { label: connectedLabel })}
              </Text>
            ) : (
              <Text size="xs" c="dimmed" truncate>
                {definition.description}
              </Text>
            )}
          </Stack>
        </Group>

        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
          {connection ? (
            <>
              {connection.invalidatedAt && (
                <Button
                  size="xs"
                  variant="light"
                  color="orange"
                  onClick={() => onConnect(definition.type)}
                >
                  {t("Reconnect")}
                </Button>
              )}
              <Button
                size="xs"
                variant="default"
                onClick={() => onDisconnect(connection.integrationId)}
                loading={disconnectingId === connection.integrationId}
              >
                {t("Disconnect")}
              </Button>
            </>
          ) : (
            <Button
              size="xs"
              variant="light"
              onClick={() => onConnect(definition.type)}
            >
              {t("Connect")}
            </Button>
          )}
        </Group>
      </Group>
    </Box>
  );
}
