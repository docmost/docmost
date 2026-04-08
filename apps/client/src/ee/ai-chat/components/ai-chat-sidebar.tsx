import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ActionIcon, Center, TextInput, Loader } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import {
  useChatsQuery,
  useDeleteChatMutation,
  useUpdateChatTitleMutation,
  useSearchChatsQuery,
} from "../queries/ai-chat-query";
import AiChatSidebarItem from "./ai-chat-sidebar-item";
import type { AiChat } from "../types/ai-chat.types";
import classes from "../styles/chat-sidebar.module.css";

export default function AiChatSidebar() {
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

  const handleNewChat = useCallback(() => {
    navigate("/ai");
  }, [navigate]);

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
        <span className={classes.title}>AI Chat</span>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={handleNewChat}
          aria-label="New chat"
        >
          <IconPlus size={18} />
        </ActionIcon>
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
        {chats.map((chat) => (
          <AiChatSidebarItem
            key={chat.id}
            chat={chat}
            isActive={chat.id === chatId}
            onDelete={handleDelete}
            onRename={handleRename}
          />
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
