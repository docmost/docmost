import { Group, Text, Button, Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IntegrationDefinition, UserConnection } from "../types/integration.types";
import { getIntegrationIcon } from "./integration-icons";

type ConnectionRowProps = {
  definition: IntegrationDefinition;
  connection?: UserConnection;
  installed: boolean;
  onConnect: (integrationId: string) => void;
  onDisconnect: (integrationId: string) => void;
  isDisconnecting?: boolean;
};

export default function ConnectionRow({
  definition,
  connection,
  installed,
  onConnect,
  onDisconnect,
  isDisconnecting,
}: ConnectionRowProps) {
  const { t } = useTranslation();
  const isConnected = !!connection;
  const isAvailable = installed && (connection?.isEnabled ?? true);

  return (
    <Box
      py="sm"
      px="xs"
      style={{
        borderBottom: "1px solid var(--mantine-color-default-border)",
        opacity: isAvailable || isConnected ? 1 : 0.5,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          {getIntegrationIcon(definition.type, 28)}
          <div>
            <Text size="sm" fw={500}>
              {definition.name}
            </Text>
            <Text size="xs" c="dimmed">
              {definition.description}
            </Text>
          </div>
        </Group>

        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
          {isConnected ? (
            <>
              <Text size="xs" c="green">
                {t("Connected")}
                {connection.providerUserId && ` (${connection.providerUserId})`}
              </Text>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => onDisconnect(connection.integrationId)}
                loading={isDisconnecting}
              >
                {t("Disconnect")}
              </Button>
            </>
          ) : isAvailable ? (
            <Button
              size="xs"
              variant="light"
              onClick={() => onConnect(definition.type)}
            >
              {t("Connect")}
            </Button>
          ) : (
            <Text size="xs" c="dimmed">
              {t("Not available")}
            </Text>
          )}
        </Group>
      </Group>
    </Box>
  );
}
