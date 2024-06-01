import { Text, Tabs, Space } from "@mantine/core";
import { IconClockHour3 } from "@tabler/icons-react";
import SpaceRecentChanges from "@/features/space/components/space-recent-changes.tsx";

export default function SpaceHomeTabs() {
  return (
    <Tabs defaultValue="recent">
      <Tabs.List>
        <Tabs.Tab value="recent" leftSection={<IconClockHour3 size={18} />}>
          <Text size="sm" fw={500}>
            Recent changes
          </Text>
        </Tabs.Tab>
      </Tabs.List>

      <Space my="md" />

      <Tabs.Panel value="recent">
        <SpaceRecentChanges />
      </Tabs.Panel>
    </Tabs>
  );
}
