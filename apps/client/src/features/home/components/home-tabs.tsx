import { Text, Tabs, Space } from "@mantine/core";
import { IconClockHour3, IconStar, IconUser } from "@tabler/icons-react";
import RecentChanges from "@/components/common/recent-changes";
import FavoritesPages from "./favorites-pages";
import CreatedByMe from "./created-by-me";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { homeTabAtom } from "@/features/home/atoms/home-tab-atom";

export default function HomeTabs() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useAtom(homeTabAtom);

  return (
    <Tabs
      color="dark"
      value={activeTab}
      onChange={(value) => {
        if (value) setActiveTab(value);
      }}
    >
      <Tabs.List style={{ flexWrap: "nowrap", overflowX: "auto" }}>
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
        <RecentChanges />
      </Tabs.Panel>
      <Tabs.Panel value="favorites">
        <FavoritesPages />
      </Tabs.Panel>
      <Tabs.Panel value="created">
        <CreatedByMe />
      </Tabs.Panel>
    </Tabs>
  );
}
