import { Group, Text, Button, Box } from "@mantine/core";
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
  const isWorkspaceScoped = definition.oauth?.connectionScope === 'workspace';

  return (
    <Box
      py="sm"
      px="xs"
      style={{
        borderBottom: "1px solid var(--mantine-color-default-border)",
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
          {isWorkspaceScoped ? (
            <>
              {connection ? (
                <Text size="xs" c="green">
                  {t("Linked")}
                  {connection.providerUserId && ` as @${connection.providerUserId}`}
                </Text>
              ) : (
                <Text size="xs" c="dimmed">
                  {t("Use")} <code>/docmost help</code> {t("in")} {definition.name} {t("to link your account.")}
                </Text>
              )}
            </>
          ) : (
            <>
              {connection ? (
                <>
                  {connection.invalidatedAt ? (
                    <>
                      <Text size="xs" c="orange">
                        {t("Connection expired")}
                      </Text>
                      <Button
                        size="xs"
                        variant="light"
                        color="orange"
                        onClick={() => onConnect(definition.type)}
                      >
                        {t("Reconnect")}
                      </Button>
                    </>
                  ) : (
                    <Text size="xs" c="green">
                      {t("Connected")}
                      {connection.providerUserId && ` (${connection.providerUserId})`}
                    </Text>
                  )}
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
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
            </>
          )}
        </Group>
      </Group>
    </Box>
  );
}
