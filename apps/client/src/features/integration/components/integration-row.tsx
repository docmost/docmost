import {
  Group,
  Text,
  Badge,
  Button,
  Box,
  Stack,
  Tooltip,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  IntegrationDefinition,
  Integration,
} from "../types/integration.types";
import { getIntegrationIcon } from "./integration-icons";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";

type IntegrationRowProps = {
  definition: IntegrationDefinition;
  installation?: Integration;
  onInstall: (type: string) => void;
  onUninstall: (integrationId: string) => void;
};

export default function IntegrationRow({
  definition,
  installation,
  onInstall,
  onUninstall,
}: IntegrationRowProps) {
  const { t } = useTranslation();
  const isInstalled = !!installation;
  const hasAccess = useHasFeature(Feature.INTEGRATIONS);
  const locked = !!definition.requiresLicense && !hasAccess;
  const upgradeLabel = useUpgradeLabel();

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
              {locked && (
                <Badge size="xs" variant="light" color="violet">
                  {t("Paid")}
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed" truncate>
              {definition.description}
            </Text>
          </Stack>
        </Group>

        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
          {isInstalled ? (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              onClick={() => onUninstall(installation.id)}
            >
              {t("Uninstall")}
            </Button>
          ) : (
            <Tooltip label={upgradeLabel} disabled={!locked}>
              <Button
                size="xs"
                variant="light"
                disabled={locked}
                onClick={() => onInstall(definition.type)}
              >
                {t("Install")}
              </Button>
            </Tooltip>
          )}
        </Group>
      </Group>
    </Box>
  );
}
