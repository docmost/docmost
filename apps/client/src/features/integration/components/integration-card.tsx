import { Card, Group, Text, Badge, Button, Stack, Switch } from "@mantine/core";
import {
  IconBrandGithub,
  IconBrandSlack,
  IconBrandGitlab,
  IconPuzzle,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  IntegrationDefinition,
  Integration,
} from "../types/integration.types";

const iconMap: Record<string, React.ElementType> = {
  github: IconBrandGithub,
  slack: IconBrandSlack,
  gitlab: IconBrandGitlab,
};

type IntegrationCardProps = {
  definition: IntegrationDefinition;
  installation?: Integration;
  onInstall: (type: string) => void;
  onUninstall: (integrationId: string) => void;
  onConfigure: (integration: Integration) => void;
  onToggle: (integration: Integration, enabled: boolean) => void;
};

export default function IntegrationCard({
  definition,
  installation,
  onInstall,
  onUninstall,
  onConfigure,
  onToggle,
}: IntegrationCardProps) {
  const { t } = useTranslation();
  const Icon = iconMap[definition.icon] ?? IconPuzzle;
  const isInstalled = !!installation;

  return (
    <Card withBorder padding="lg" radius="md">
      <Group justify="space-between" mb="sm">
        <Group gap="sm">
          <Icon size={28} stroke={1.5} />
          <div>
            <Text fw={600} size="sm">
              {definition.name}
            </Text>
            <Text size="xs" c="dimmed">
              {definition.description}
            </Text>
          </div>
        </Group>
      </Group>

      <Group gap="xs" mb="md">
        {definition.capabilities.map((cap) => (
          <Badge key={cap} size="xs" variant="light">
            {cap}
          </Badge>
        ))}
      </Group>

      {isInstalled ? (
        <Stack gap="xs">
          <Group justify="space-between">
            <Switch
              label={t("Enabled")}
              checked={installation.isEnabled}
              onChange={(e) => onToggle(installation, e.currentTarget.checked)}
              size="sm"
            />
          </Group>
          <Group gap="xs">
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
          </Group>
        </Stack>
      ) : (
        <Button
          size="xs"
          variant="light"
          onClick={() => onInstall(definition.type)}
        >
          {t("Install")}
        </Button>
      )}
    </Card>
  );
}
