import { useState } from "react";
import {
  ActionIcon,
  Group,
  Indicator,
  Menu,
  Popover,
  ScrollArea,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconBell,
  IconCheck,
  IconChecks,
  IconDots,
  IconFilter,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { NotificationList } from "./notification-list";
import { NotificationFilter } from "../types/notification.types";
import {
  useMarkAllReadMutation,
  useUnreadCountQuery,
} from "../queries/notification-query";

export function NotificationPopover() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const { data: unreadData } = useUnreadCountQuery();
  const markAllRead = useMarkAllReadMutation();

  const unreadCount = unreadData?.count ?? 0;

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <Popover
      position="bottom-end"
      shadow="lg"
      opened={opened}
      onChange={setOpened}
      withArrow
    >
      <Popover.Target>
        <Tooltip label={t("Notifications")} withArrow>
          <ActionIcon
            variant="subtle"
            color="dark"
            size="sm"
            onClick={() => setOpened((o) => !o)}
          >
            <Indicator
              offset={5}
              color="red"
              withBorder
              disabled={unreadCount === 0}
            >
              <IconBell size={20} />
            </Indicator>
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown
        p={0}
        style={{ width: "min(420px, calc(100vw - 24px))" }}
      >
        <Group justify="space-between" px="md" py="sm">
          <Text fw={600} size="sm">
            {t("Notifications")}
          </Text>
          <Group gap={4}>
            <Menu position="bottom-end" withArrow withinPortal={false}>
              <Menu.Target>
                <Tooltip label={t("Filter")} withArrow>
                  <ActionIcon variant="subtle" color="dark" size="sm">
                    <IconFilter size={16} />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t("Filter")}</Menu.Label>
                <Menu.Item
                  onClick={() => setFilter("all")}
                  rightSection={
                    filter === "all" ? <IconCheck size={14} /> : null
                  }
                >
                  {t("All notifications")}
                </Menu.Item>
                <Menu.Item
                  onClick={() => setFilter("unread")}
                  rightSection={
                    filter === "unread" ? <IconCheck size={14} /> : null
                  }
                >
                  {t("Unread only")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            <Menu position="bottom-end" withArrow withinPortal={false}>
              <Menu.Target>
                <Tooltip label={t("More options")} withArrow>
                  <ActionIcon variant="subtle" color="dark" size="sm">
                    <IconDots size={16} />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconChecks size={16} />}
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                >
                  {t("Mark all as read")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        <ScrollArea.Autosize
          mah={500}
          type="auto"
          offsetScrollbars
          scrollbarSize={6}
        >
          <NotificationList
            filter={filter}
            onNavigate={() => setOpened(false)}
          />
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
