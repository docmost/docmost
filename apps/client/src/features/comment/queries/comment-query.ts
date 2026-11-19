import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import {
  createComment,
  deleteComment,
  getPageComments,
  resolveComment,
  updateComment,
} from "@/features/comment/services/comment-service";
import {
  ICommentParams,
  IComment,
  IResolveComment,
} from "@/features/comment/types/comment.types";
import { notifications } from "@mantine/notifications";
import { IPagination } from "@/lib/types.ts";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo } from "react";

export const RQ_KEY = (pageId: string) => ["comments", pageId];

export function useCommentsQuery(params: ICommentParams) {
  const query = useInfiniteQuery({
    queryKey: RQ_KEY(params.pageId),
    queryFn: ({ pageParam }) =>
      getPageComments({ pageId: params.pageId, cursor: pageParam, limit: 100 }),
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

  const data = useMemo<IPagination<IComment> | undefined>(() => {
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

export function useCreateCommentMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IComment, Error, Partial<IComment>>({
    mutationFn: (data) => createComment(data),
    onSuccess: (newComment) => {
      const cache = queryClient.getQueryData(
        RQ_KEY(newComment.pageId),
      ) as InfiniteData<IPagination<IComment>> | undefined;

      if (cache && cache.pages.length > 0) {
        const alreadyExists = cache.pages.some((page) =>
          page.items.some((c) => c.id === newComment.id),
        );
        if (alreadyExists) return;

        const lastIdx = cache.pages.length - 1;
        queryClient.setQueryData(RQ_KEY(newComment.pageId), {
          ...cache,
          pages: cache.pages.map((page, i) =>
            i === lastIdx
              ? { ...page, items: [...page.items, newComment] }
              : page,
          ),
        });
      }

      notifications.show({ message: t("Comment created successfully") });
    },
    onError: () => {
      notifications.show({
        message: t("Error creating comment"),
        color: "red",
      });
    },
  });
}

export function useUpdateCommentMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IComment, Error, Partial<IComment>>({
    mutationFn: (data) => updateComment(data),
    onSuccess: (updatedComment) => {
      const cache = queryClient.getQueryData(
        RQ_KEY(updatedComment.pageId),
      ) as InfiniteData<IPagination<IComment>> | undefined;

      if (cache) {
        queryClient.setQueryData(RQ_KEY(updatedComment.pageId), {
          ...cache,
          pages: cache.pages.map((page) => ({
            ...page,
            items: page.items.map((comment) =>
              comment.id === updatedComment.id ? updatedComment : comment,
            ),
          })),
        });
      }

      notifications.show({ message: t("Comment updated successfully") });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to update comment"),
        color: "red",
      });
    },
  });
}

export function useDeleteCommentMutation(pageId?: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (_data, commentId) => {
      const cache = queryClient.getQueryData(
        RQ_KEY(pageId),
      ) as InfiniteData<IPagination<IComment>> | undefined;

      if (cache) {
        queryClient.setQueryData(RQ_KEY(pageId), {
          ...cache,
          pages: cache.pages.map((page) => ({
            ...page,
            items: page.items.filter((comment) => comment.id !== commentId),
          })),
        });
      }

      notifications.show({ message: t("Comment deleted successfully") });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to delete comment"),
        color: "red",
      });
    },
  });
}

function updateCommentInCache(
  cache: InfiniteData<IPagination<IComment>>,
  commentId: string,
  updater: (comment: IComment) => IComment,
): InfiniteData<IPagination<IComment>> {
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      items: page.items.map((comment) =>
        comment.id === commentId ? updater(comment) : comment,
      ),
    })),
  };
}

export function useResolveCommentMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: IResolveComment) => resolveComment(data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: RQ_KEY(variables.pageId) });
      const previousCache = queryClient.getQueryData(RQ_KEY(variables.pageId));

      const cache = previousCache as InfiniteData<IPagination<IComment>> | undefined;
      if (cache) {
        queryClient.setQueryData(
          RQ_KEY(variables.pageId),
          updateCommentInCache(cache, variables.commentId, (comment) => ({
            ...comment,
            resolvedAt: variables.resolved ? new Date() : null,
            resolvedById: variables.resolved ? "optimistic" : null,
            resolvedBy: variables.resolved
              ? ({ id: "optimistic", name: "", avatarUrl: null } as IComment["resolvedBy"])
              : null,
          })),
        );
      }

      return { previousCache };
    },
    onError: (_err, variables, context) => {
      if (context?.previousCache) {
        queryClient.setQueryData(RQ_KEY(variables.pageId), context.previousCache);
      }
      notifications.show({
        message: t("Failed to resolve comment"),
        color: "red",
      });
    },
    onSuccess: (data: IComment, variables) => {
      const cache = queryClient.getQueryData(
        RQ_KEY(data.pageId),
      ) as InfiniteData<IPagination<IComment>> | undefined;

      if (cache) {
        queryClient.setQueryData(
          RQ_KEY(data.pageId),
          updateCommentInCache(cache, variables.commentId, (comment) => ({
            ...comment,
            resolvedAt: data.resolvedAt,
            resolvedById: data.resolvedById,
            resolvedBy: data.resolvedBy,
          })),
        );
      }

      notifications.show({
        message: variables.resolved
          ? t("Comment resolved successfully")
          : t("Comment re-opened successfully"),
      });
    },
  });
} 
