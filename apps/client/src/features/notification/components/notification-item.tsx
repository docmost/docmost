import {
  ActionIcon,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconCheck,
  IconFileDescription,
  IconPointFilled,
} from "@tabler/icons-react";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { INotification } from "../types/notification.types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useMarkReadMutation } from "../queries/notification-query";
import { buildPageUrl } from "@/features/page/page.utils";
import { formatRelativeTime } from "../notification.utils";
import classes from "../notification.module.css";

type NotificationItemProps = {
  notification: INotification;
  onNavigate: () => void;
};

export function NotificationItem({
  notification,
  onNavigate,
}: NotificationItemProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const markRead = useMarkReadMutation();
  const [hovered, setHovered] = useState(false);

  const isUnread = !notification.readAt;

  const getNotificationMessage = (): string => {
    switch (notification.type) {
      case "comment.user_mention":
        return t("mentioned you in a comment");
      case "comment.created":
        return t("commented on a page");
      case "comment.resolved":
        return t("resolved a comment");
      case "page.user_mention":
        return t("mentioned you on a page");
      default:
        return "";
    }
  };

  const handleClick = () => {
    if (notification.page && notification.space) {
      if (isUnread) {
        markRead.mutate([notification.id]);
      }
      navigate(
        buildPageUrl(
          notification.space.slug,
          notification.page.slugId,
          notification.page.title,
        ),
      );
      onNavigate();
    }
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUnread) {
      markRead.mutate([notification.id]);
    }
  };

  return (
    <UnstyledButton
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      w="100%"
      className={classes.notificationItem}
    >
      <Group wrap="nowrap" align="flex-start" gap="sm">
        <CustomAvatar
          avatarUrl={notification.actor?.avatarUrl}
          name={notification.actor?.name || "?"}
          size="sm"
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" lineClamp={2}>
            <Text span fw={600}>
              {notification.actor?.name}
            </Text>{" "}
            {getNotificationMessage()}
          </Text>

          {notification.page && (
            <Group gap={4} mt={2} wrap="nowrap">
              {notification.page.icon ? (
                <Text size="xs" style={{ flexShrink: 0 }}>
                  {notification.page.icon}
                </Text>
              ) : (
                <IconFileDescription
                  size={14}
                  stroke={1.5}
                  style={{ flexShrink: 0, color: "var(--mantine-color-dimmed)" }}
                />
              )}
              <Text size="xs" c="dimmed" lineClamp={1}>
                {notification.page.title || t("Untitled")}
              </Text>
            </Group>
          )}
        </div>

        <Group gap={4} wrap="nowrap" align="center" style={{ flexShrink: 0 }}>
          {hovered && isUnread ? (
            <Tooltip label={t("Mark as read")} withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleMarkRead}
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
              {formatRelativeTime(notification.createdAt)}
            </Text>
          )}

          {isUnread && (
            <IconPointFilled
              size={12}
              color="var(--mantine-color-blue-filled)"
              style={{ flexShrink: 0 }}
            />
          )}
        </Group>
      </Group>
    </UnstyledButton>
  );
}
