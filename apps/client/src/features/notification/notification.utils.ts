import { INotification } from "./types/notification.types";

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type TimeGroup = "today" | "yesterday" | "this_week" | "older";

export function getTimeGroup(dateStr: string): TimeGroup {
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  if (date >= startOfToday) return "today";
  if (date >= startOfYesterday) return "yesterday";
  if (date >= startOfWeek) return "this_week";
  return "older";
}

export type GroupedNotifications = {
  key: TimeGroup;
  label: string;
  notifications: INotification[];
};

export function groupNotificationsByTime(
  notifications: INotification[],
  labels: Record<TimeGroup, string>,
): GroupedNotifications[] {
  const groups: Record<TimeGroup, INotification[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    older: [],
  };

  for (const notification of notifications) {
    const group = getTimeGroup(notification.createdAt);
    groups[group].push(notification);
  }

  const order: TimeGroup[] = ["today", "yesterday", "this_week", "older"];

  return order
    .filter((key) => groups[key].length > 0)
    .map((key) => ({
      key,
      label: labels[key],
      notifications: groups[key],
    }));
}
