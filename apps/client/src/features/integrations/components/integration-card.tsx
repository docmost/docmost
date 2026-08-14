import { ReactNode } from "react";
import { Button, Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

interface IntegrationCardProps {
  name: string;
  description: string;
  icon?: ReactNode;
  connected: boolean;
  loading?: boolean;
  disconnecting?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  // optional control rendered before the connect/disconnect button (e.g. admin config)
  adminControl?: ReactNode;
}

// Provider-agnostic settings row for an integration; connect/disconnect
// mechanics live in each provider's own component.
export default function IntegrationCard({
  name,
  description,
  icon,
  connected,
  loading,
  disconnecting,
  onConnect,
  onDisconnect,
  adminControl,
}: IntegrationCardProps) {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap">
      <Group wrap="nowrap" gap="sm">
        {icon}
        <Stack gap={2}>
          <Text fw={500}>{name}</Text>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </Stack>
      </Group>

      <Group wrap="nowrap" gap="xs">
        {adminControl}
        {connected ? (
          <Button
            variant="default"
            loading={disconnecting}
            onClick={onDisconnect}
          >
            {t("Disconnect")}
          </Button>
        ) : (
          <Button loading={loading} onClick={onConnect}>
            {t("Connect")}
          </Button>
        )}
      </Group>
    </Group>
  );
}
