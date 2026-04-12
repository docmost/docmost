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
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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
  const markRead = useMarkReadMutation();
  const [hovered, setHovered] = useState(false);

  const isUnread = !notification.readAt;

  const getNotificationMessageKey = (): string => {
    switch (notification.type) {
      case "comment.user_mention":
        return "<bold>{{name}}</bold> mentioned you in a comment";
      case "comment.created":
        return "<bold>{{name}}</bold> commented on a page";
      case "comment.resolved":
        return "<bold>{{name}}</bold> resolved a comment";
      case "page.user_mention":
        return "<bold>{{name}}</bold> mentioned you on a page";
      case "page.permission_granted":
        return notification.data?.role === "writer"
          ? "<bold>{{name}}</bold> gave you edit access to a page"
          : "<bold>{{name}}</bold> gave you view access to a page";
      case "page.updated":
        return "<bold>{{name}}</bold> updated a page";
      default:
        return "";
    }
  };

  const pageUrl =
    notification.page && notification.space
      ? buildPageUrl(
          notification.space.slug,
          notification.page.slugId,
          notification.page.title,
        )
      : undefined;

  const markReadIfNeeded = () => {
    if (isUnread) {
      markRead.mutate([notification.id]);
    }
  };

  const handleClick = () => {
    markReadIfNeeded();
    onNavigate();
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    markReadIfNeeded();
  };

  return (
    <UnstyledButton
      component={Link}
      to={pageUrl ?? ""}
      onClick={handleClick}
      // auxclick fires for all non-primary buttons; guard to middle-click only (button 1)
      // so that right-click (button 2, context menu) does not mark as read
      onAuxClick={(e: React.MouseEvent) => e.button === 1 && markReadIfNeeded()}
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
            <Trans
              i18nKey={getNotificationMessageKey()}
              values={{ name: notification.actor?.name }}
              components={{ bold: <Text span fw={600} /> }}
            />
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
