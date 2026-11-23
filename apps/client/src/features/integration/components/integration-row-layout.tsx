import { ReactNode } from "react";
import { Box, Group, Stack, Text } from "@mantine/core";

type IntegrationRowLayoutProps = {
  icon: ReactNode;
  name: ReactNode;
  badge?: ReactNode;
  description: ReactNode;
  actions: ReactNode;
};

export default function IntegrationRowLayout({
  icon,
  name,
  badge,
  description,
  actions,
}: IntegrationRowLayoutProps) {
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
          <Box style={{ display: "flex", flexShrink: 0 }}>{icon}</Box>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" fw={500}>
                {name}
              </Text>
              {badge}
            </Group>
            <Text size="xs" c="dimmed" truncate>
              {description}
            </Text>
          </Stack>
        </Group>

        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
          {actions}
        </Group>
      </Group>
    </Box>
  );
}
