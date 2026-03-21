import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import {
  createTodo,
  deleteTodo,
  getPageTodos,
  getSpaceTodos,
  updateTodo,
} from "@/features/todo/services/todo-service";
import { ITodoParams, ISpaceTodoParams, ITodo } from "@/features/todo/types/todo.types";
import { notifications } from "@mantine/notifications";
import { IPagination } from "@/lib/types.ts";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo } from "react";

export const RQ_KEY = (pageId: string) => ["todos", pageId];

export function useTodosQuery(params: ITodoParams) {
  const query = useInfiniteQuery({
    queryKey: RQ_KEY(params.pageId),
    queryFn: ({ pageParam }) =>
      getPageTodos({ pageId: params.pageId, cursor: pageParam, limit: 100 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    enabled: !!params.pageId,
  });

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  const data = useMemo<IPagination<ITodo> | undefined>(() => {
    if (!query.data) return undefined;
    return {
      items: query.data.pages.flatMap((p) => p.items),
      meta: query.data.pages[query.data.pages.length - 1].meta,
    };
  }, [query.data]);

  return {
    data,
    isLoading: query.isLoading || query.hasNextPage,
    isError: query.isError,
  };
}

export const SPACE_RQ_KEY = (spaceId: string) => ["space-todos", spaceId];

export function useSpaceTodosQuery(params: ISpaceTodoParams) {
  const query = useInfiniteQuery({
    queryKey: SPACE_RQ_KEY(params.spaceId),
    queryFn: ({ pageParam }) =>
      getSpaceTodos({ spaceId: params.spaceId, cursor: pageParam, limit: 200 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    enabled: !!params.spaceId,
  });

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  const data = useMemo<IPagination<ITodo> | undefined>(() => {
    if (!query.data) return undefined;
    return {
      items: query.data.pages.flatMap((p) => p.items),
      meta: query.data.pages[query.data.pages.length - 1].meta,
    };
  }, [query.data]);

  return {
    data,
    isLoading: query.isLoading || query.hasNextPage,
    isError: query.isError,
  };
}

export function useCreateTodoMutation() {
  const queryClient = useQueryClient();

  return useMutation<ITodo, Error, { pageId: string; title: string }>({
    mutationFn: (data) => createTodo(data),
    onSuccess: (newTodo) => {
      const cache = queryClient.getQueryData(
        RQ_KEY(newTodo.pageId),
      ) as InfiniteData<IPagination<ITodo>> | undefined;

      if (cache && cache.pages.length > 0) {
        const lastIdx = cache.pages.length - 1;
        queryClient.setQueryData(RQ_KEY(newTodo.pageId), {
          ...cache,
          pages: cache.pages.map((page, i) =>
            i === lastIdx
              ? { ...page, items: [...page.items, newTodo] }
              : page,
          ),
        });
      }

      if (newTodo.spaceId) {
        queryClient.invalidateQueries({ queryKey: SPACE_RQ_KEY(newTodo.spaceId) });
      }
    },
    onError: () => {
      notifications.show({ message: "Error creating todo", color: "red" });
    },
  });
}

export function useUpdateTodoMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    ITodo,
    Error,
    { todoId: string; title?: string; completed?: boolean; pageId: string }
  >({
    mutationFn: (data) => updateTodo(data),
    onSuccess: (updatedTodo) => {
      const cache = queryClient.getQueryData(
        RQ_KEY(updatedTodo.pageId),
      ) as InfiniteData<IPagination<ITodo>> | undefined;

      if (cache) {
        queryClient.setQueryData(RQ_KEY(updatedTodo.pageId), {
          ...cache,
          pages: cache.pages.map((page) => ({
            ...page,
            items: page.items.map((todo) =>
              todo.id === updatedTodo.id ? updatedTodo : todo,
            ),
          })),
        });
      }

      if (updatedTodo.spaceId) {
        const spaceCache = queryClient.getQueryData(
          SPACE_RQ_KEY(updatedTodo.spaceId),
        ) as InfiniteData<IPagination<ITodo>> | undefined;

        if (spaceCache) {
          queryClient.setQueryData(SPACE_RQ_KEY(updatedTodo.spaceId), {
            ...spaceCache,
            pages: spaceCache.pages.map((page) => ({
              ...page,
              items: page.items.map((todo) =>
                todo.id === updatedTodo.id ? updatedTodo : todo,
              ),
            })),
          });
        }
      }
    },
    onError: () => {
      notifications.show({ message: "Failed to update todo", color: "red" });
    },
  });
}

export function useDeleteTodoMutation(pageId?: string, spaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (todoId: string) => deleteTodo(todoId),
    onSuccess: (_data, todoId) => {
      const cache = queryClient.getQueryData(
        RQ_KEY(pageId),
      ) as InfiniteData<IPagination<ITodo>> | undefined;

      if (cache) {
        queryClient.setQueryData(RQ_KEY(pageId), {
          ...cache,
          pages: cache.pages.map((page) => ({
            ...page,
            items: page.items.filter((todo) => todo.id !== todoId),
          })),
        });
      }

      if (spaceId) {
        const spaceCache = queryClient.getQueryData(
          SPACE_RQ_KEY(spaceId),
        ) as InfiniteData<IPagination<ITodo>> | undefined;

        if (spaceCache) {
          queryClient.setQueryData(SPACE_RQ_KEY(spaceId), {
            ...spaceCache,
            pages: spaceCache.pages.map((page) => ({
              ...page,
              items: page.items.filter((todo) => todo.id !== todoId),
            })),
          });
        }
      }
    },
    onError: () => {
      notifications.show({ message: "Failed to delete todo", color: "red" });
    },
  });
}
