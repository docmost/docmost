import { Center, Divider, Loader, Stack, Text } from "@mantine/core";
import { IconBellOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import { NotificationItem } from "./notification-item";
import { INotification, NotificationFilter } from "../types/notification.types";
import { groupNotificationsByTime } from "../notification.utils";
import { useNotificationsQuery } from "../queries/notification-query";
import classes from "../notification.module.css";

type NotificationListProps = {
  filter: NotificationFilter;
  onNavigate: () => void;
};

export function NotificationList({
  filter,
  onNavigate,
}: NotificationListProps) {
  const { t } = useTranslation();
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useNotificationsQuery();

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  const allNotifications =
    data?.pages.flatMap((page) => page.items) ?? [];

  const filtered =
    filter === "unread"
      ? allNotifications.filter((n) => !n.readAt)
      : allNotifications;

  if (filtered.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="xs">
          <IconBellOff size={32} stroke={1.5} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed">
            {filter === "unread"
              ? t("No unread notifications")
              : t("No notifications")}
          </Text>
        </Stack>
      </Center>
    );
  }

  const timeGroupLabels = {
    today: t("Today"),
    yesterday: t("Yesterday"),
    this_week: t("This week"),
    older: t("Older"),
  };

  const groups = groupNotificationsByTime(filtered, timeGroupLabels);

  return (
    <Stack gap={0}>
      {groups.map((group, groupIndex) => (
        <div key={group.key}>
          {groupIndex > 0 && <Divider className={classes.divider} />}
          <Text size="xs" fw={600} c="dimmed" px="md" pt="sm" pb={4}>
            {group.label}
          </Text>
          {group.notifications.map((notification: INotification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}

      <div ref={sentinelRef} style={{ height: 1 }} />

      {isFetchingNextPage && (
        <Center py="xs">
          <Loader size="xs" />
        </Center>
      )}
    </Stack>
  );
}
