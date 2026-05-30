import type { AiChat } from "../types/ai-chat.types";

export type ChatGroup = { key: string; label: string; chats: AiChat[] };

export function groupChatsByAge(
  chats: AiChat[],
  t: (key: string) => string,
): ChatGroup[] {
  if (chats.length === 0) return [];

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfLast7 = startOfToday - 7 * 24 * 60 * 60 * 1000;
  const startOfLast30 = startOfToday - 30 * 24 * 60 * 60 * 1000;

  const buckets: Record<string, ChatGroup> = {
    today: { key: "today", label: t("Today"), chats: [] },
    yesterday: { key: "yesterday", label: t("Yesterday"), chats: [] },
    last7: { key: "last7", label: t("Previous 7 days"), chats: [] },
    last30: { key: "last30", label: t("Previous 30 days"), chats: [] },
    older: { key: "older", label: t("Older"), chats: [] },
  };

  for (const chat of chats) {
    const ts = new Date(chat.updatedAt).getTime();
    if (ts >= startOfToday) buckets.today.chats.push(chat);
    else if (ts >= startOfYesterday) buckets.yesterday.chats.push(chat);
    else if (ts >= startOfLast7) buckets.last7.chats.push(chat);
    else if (ts >= startOfLast30) buckets.last30.chats.push(chat);
    else buckets.older.chats.push(chat);
  }

  return [
    buckets.today,
    buckets.yesterday,
    buckets.last7,
    buckets.last30,
    buckets.older,
  ].filter((b) => b.chats.length > 0);
}
