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
import { groupChatsByAge } from "../utils/group-chats-by-age";
import classes from "../styles/chat-sidebar.module.css";

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
