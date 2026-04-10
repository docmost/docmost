import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ActionIcon, Center, TextInput, Loader, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconPlus, IconSearch, IconMessageCircle2 } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useChatsQuery,
  useDeleteChatMutation,
  useUpdateChatTitleMutation,
  useSearchChatsQuery,
} from "../queries/ai-chat-query";
import AiChatSidebarItem from "./ai-chat-sidebar-item";
import type { AiChat } from "../types/ai-chat.types";
import classes from "../styles/chat-sidebar.module.css";

type ChatGroup = { key: string; label: string; chats: AiChat[] };

function groupChatsByAge(
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

export default function AiChatSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId: string }>();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const chatsQuery = useChatsQuery();
  const searchQuery = useSearchChatsQuery(debouncedSearch);
  const deleteMutation = useDeleteChatMutation();
  const renameMutation = useUpdateChatTitleMutation();

  const chats = useMemo(() => {
    if (debouncedSearch) {
      return searchQuery.data || [];
    }
    return chatsQuery.data?.pages.flatMap((p) => p.items) || [];
  }, [debouncedSearch, searchQuery.data, chatsQuery.data]);

  const groupedChats = useMemo(() => groupChatsByAge(chats, t), [chats, t]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, fetchNextPage, isFetchingNextPage } = chatsQuery;
  const isSearching = Boolean(debouncedSearch);

  useEffect(() => {
    if (isSearching) return;
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
  }, [isSearching, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleNewChat = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }
      event.preventDefault();
      navigate("/ai");
    },
    [navigate],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          if (chatId === id) {
            navigate("/ai");
          }
        },
      });
    },
    [deleteMutation, chatId, navigate],
  );

  const handleRename = useCallback(
    (chatId: string, title: string) => {
      renameMutation.mutate({ chatId, title });
    },
    [renameMutation],
  );

  const isLoading = chatsQuery.isLoading || searchQuery.isLoading;

  return (
    <div className={classes.sidebar}>
      <div className={classes.header}>
        <span className={classes.title}>{t("AI Chat")}</span>
        <Tooltip label={t("New chat")} openDelay={250} withArrow>
          <ActionIcon
            component={Link}
            to="/ai"
            variant="subtle"
            color="gray"
            onClick={handleNewChat}
            aria-label={t("New chat")}
          >
            <IconPlus size={18} />
          </ActionIcon>
        </Tooltip>
      </div>

      <TextInput
        className={classes.searchInput}
        placeholder="Search chats..."
        leftSection={<IconSearch size={14} />}
        size="xs"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      <div className={classes.chatList}>
        {isLoading && <Loader size="xs" mx="auto" mt="md" />}
        {!isLoading && chats.length === 0 && (
          <div className={classes.chatListEmpty}>
            <IconMessageCircle2
              size={28}
              stroke={1.5}
              className={classes.chatListEmptyIcon}
            />
            <div className={classes.chatListEmptyTitle}>
              {isSearching ? t("No chats found") : t("No conversations yet")}
            </div>
            <div className={classes.chatListEmptyHint}>
              {isSearching
                ? t("Try a different search term.")
                : t("Start a new chat to see it here.")}
            </div>
          </div>
        )}
        {isSearching
          ? chats.map((chat) => (
              <AiChatSidebarItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === chatId}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))
          : groupedChats.map((group) => (
              <div key={group.key} className={classes.chatGroup}>
                <div className={classes.chatGroupLabel}>{group.label}</div>
                {group.chats.map((chat) => (
                  <AiChatSidebarItem
                    key={chat.id}
                    chat={chat}
                    isActive={chat.id === chatId}
                    onDelete={handleDelete}
                    onRename={handleRename}
                  />
                ))}
              </div>
            ))}
        {!isSearching && (
          <>
            <div ref={sentinelRef} style={{ height: 1 }} />
            {isFetchingNextPage && (
              <Center py="xs">
                <Loader size="xs" />
              </Center>
            )}
          </>
        )}
      </div>
    </div>
  );
}
