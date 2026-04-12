import { Text, Tabs, Space } from "@mantine/core";
import { IconClockHour3, IconStar, IconUser } from "@tabler/icons-react";
import RecentChanges from "@/components/common/recent-changes";
import FavoritesPages from "@/features/home/components/favorites-pages";
import CreatedByMe from "@/features/home/components/created-by-me";
import { useParams } from "react-router-dom";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "space-home-tab";
const DEFAULT_TAB = "recent";
const VALID_TABS = ["recent", "favorites", "created"];

function getStoredTab(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && VALID_TABS.includes(stored) ? stored : DEFAULT_TAB;
}

export default function SpaceHomeTabs() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  return (
    <Tabs
      color="dark"
      defaultValue={getStoredTab()}
      onChange={(value) => {
        if (value) localStorage.setItem(STORAGE_KEY, value);
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="recent" leftSection={<IconClockHour3 size={18} />}>
          <Text size="sm" fw={500}>
            {t("Recently updated")}
          </Text>
        </Tabs.Tab>
        <Tabs.Tab value="favorites" leftSection={<IconStar size={18} />}>
          <Text size="sm" fw={500}>
            {t("Favorites")}
          </Text>
        </Tabs.Tab>
        <Tabs.Tab value="created" leftSection={<IconUser size={18} />}>
          <Text size="sm" fw={500}>
            {t("Created by me")}
          </Text>
        </Tabs.Tab>
      </Tabs.List>

      <Space my="md" />

      <Tabs.Panel value="recent">
        {space?.id && <RecentChanges spaceId={space.id} />}
      </Tabs.Panel>
      <Tabs.Panel value="favorites">
        <FavoritesPages />
      </Tabs.Panel>
      <Tabs.Panel value="created">
        {space?.id && <CreatedByMe spaceId={space.id} />}
      </Tabs.Panel>
    </Tabs>
  );
}
