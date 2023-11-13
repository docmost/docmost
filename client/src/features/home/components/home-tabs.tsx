import { Text, Tabs, Space } from '@mantine/core';
import {
  IconClockHour3, IconStar,
} from '@tabler/icons-react';
import RecentChanges from '@/features/home/components/recent-changes';

export default function HomeTabs() {

  return (
    <Tabs defaultValue="recent">
      <Tabs.List>
        <Tabs.Tab value="recent" leftSection={<IconClockHour3 size={18} />}>
          <Text size="sm" fw={500}>Recent changes</Text>
        </Tabs.Tab>

        <Tabs.Tab value="favorites" leftSection={<IconStar size={18} />}>
          <Text size="sm" fw={500}>Favorites</Text>
        </Tabs.Tab>
      </Tabs.List>

      <Space my="md" />

      <Tabs.Panel value="recent">

        <RecentChanges />

      </Tabs.Panel>

      <Tabs.Panel value="favorites">
        My favorite pages
      </Tabs.Panel>
    </Tabs>
  );
}
