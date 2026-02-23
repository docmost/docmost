import { Group, Text, Badge, Button, Switch, Box, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  IntegrationDefinition,
  Integration,
} from "../types/integration.types";
import { getIntegrationIcon } from "./integration-icons";

type IntegrationRowProps = {
  definition: IntegrationDefinition;
  installation?: Integration;
  onInstall: (type: string) => void;
  onUninstall: (integrationId: string) => void;
  onConfigure: (integration: Integration) => void;
  onToggle: (integration: Integration, enabled: boolean) => void;
};

export default function IntegrationRow({
  definition,
  installation,
  onInstall,
  onUninstall,
  onConfigure,
  onToggle,
}: IntegrationRowProps) {
  const { t } = useTranslation();
  const isInstalled = !!installation;

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
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" fw={500}>
                {definition.name}
              </Text>
              {definition.capabilities.map((cap) => (
                <Badge key={cap} size="xs" variant="light">
                  {cap}
                </Badge>
              ))}
            </Group>
            <Text size="xs" c="dimmed" truncate>
              {definition.description}
            </Text>
          </Stack>
        </Group>

        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
          {isInstalled ? (
            <>
              <Switch
                checked={installation.isEnabled}
                onChange={(e) =>
                  onToggle(installation, e.currentTarget.checked)
                }
                size="sm"
              />
              <Button
                size="xs"
                variant="light"
                onClick={() => onConfigure(installation)}
              >
                {t("Configure")}
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => onUninstall(installation.id)}
              >
                {t("Uninstall")}
              </Button>
            </>
          ) : (
            <Button
              size="xs"
              variant="light"
              onClick={() => onInstall(definition.type)}
            >
              {t("Install")}
            </Button>
          )}
        </Group>
      </Group>
    </Box>
  );
}
