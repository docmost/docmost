import api from "@/lib/api-client";
import { INotification } from "../types/notification.types";
import { IPagination } from "@/lib/types";

export async function getNotifications(params: {
  limit?: number;
  cursor?: string;
}): Promise<IPagination<INotification>> {
  const req = await api.post<IPagination<INotification>>(
    "/notifications",
    params,
  );
  return req.data;
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const req = await api.post<{ count: number }>(
    "/notifications/unread-count",
  );
  return req.data;
}

export async function markNotificationsRead(
  notificationIds: string[],
): Promise<void> {
  await api.post("/notifications/mark-read", { notificationIds });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/mark-all-read");
}
