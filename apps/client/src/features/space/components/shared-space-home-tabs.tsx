import { Text, Tabs, Space } from "@mantine/core";
import { IconClockHour3 } from "@tabler/icons-react";
import SharedRecentChanges from "@/components/common/shared-recent-changes.tsx";
import { useParams } from "react-router-dom";
import { useGetSharedSpaceBySlugQuery } from "@/features/space/queries/shared-space-query.ts";
import { useTranslation } from "react-i18next";

export default function SharedSpaceHomeTabs() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSharedSpaceBySlugQuery(spaceSlug);

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

      <Tabs.Panel value="recent">
        {space?.id && <SharedRecentChanges spaceId={space.id} />}
      </Tabs.Panel>
    </Tabs>
  );
}
