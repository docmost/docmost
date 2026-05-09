import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  listChats,
  getChatInfo,
  deleteChat,
  updateChatTitle,
  searchChats,
} from "../services/ai-chat-service";

export function useChatsQuery() {
  return useInfiniteQuery({
    queryKey: ["ai-chats"],
    queryFn: ({ pageParam }) =>
      listChats({ cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
  });
}

export function useChatInfoQuery(chatId: string | undefined) {
  return useQuery({
    queryKey: ["ai-chat", chatId],
    queryFn: () => getChatInfo(chatId!),
    enabled: !!chatId,
  });
}

export function useDeleteChatMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => deleteChat(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-chats"] });
    },
  });
}

export function useUpdateChatTitleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, title }: { chatId: string; title: string }) =>
      updateChatTitle(chatId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-chats"] });
    },
  });
}

export function useSearchChatsQuery(query: string) {
  return useQuery({
    queryKey: ["ai-chats-search", query],
    queryFn: () => searchChats(query),
    enabled: query.length > 0,
  });
}
