import { Text, Tabs, Space } from "@mantine/core";
import { IconClockHour3 } from "@tabler/icons-react";
import RecentChanges from "@/components/common/recent-changes.tsx";
import { useParams } from "react-router-dom";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useTranslation } from "react-i18next";
import { BaseTable } from "@/features/base/components/base-table.tsx";

export default function SpaceHomeTabs() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  return (
    <Tabs defaultValue="recent">
      <Tabs.List>
        <Tabs.Tab value="recent" leftSection={<IconClockHour3 size={18} />}>
          <Text size="sm" fw={500}>
            {t("Recently updated")}
          </Text>
        </Tabs.Tab>
      </Tabs.List>

      <Space my="md" />

      <BaseTable baseId={"019c69a5-1d84-7985-a7f6-8ee2871d8669"}/>

      <Tabs.Panel value="recent">
        {space?.id && <RecentChanges spaceId={space.id} />}
      </Tabs.Panel>
    </Tabs>
  );
}
