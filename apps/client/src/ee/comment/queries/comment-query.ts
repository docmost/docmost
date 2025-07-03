import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { resolveComment } from "@/features/comment/services/comment-service";
import {
  IComment,
  IResolveComment,
} from "@/features/comment/types/comment.types";
import { notifications } from "@mantine/notifications";
import { IPagination } from "@/lib/types.ts";
import { useTranslation } from "react-i18next";
import { useQueryEmit } from "@/features/websocket/use-query-emit";
import { RQ_KEY } from "@/features/comment/queries/comment-query";

export function useResolveCommentMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const emit = useQueryEmit();

  return useMutation({
    mutationFn: (data: IResolveComment) => resolveComment(data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: RQ_KEY(variables.pageId) });
      const previousComments = queryClient.getQueryData(RQ_KEY(variables.pageId));
      queryClient.setQueryData(RQ_KEY(variables.pageId), (old: IPagination<IComment>) => {
        if (!old || !old.items) return old;
        const updatedItems = old.items.map((comment) =>
          comment.id === variables.commentId
            ? { 
                ...comment, 
                resolvedAt: variables.resolved ? new Date() : null, 
                resolvedById: variables.resolved ? 'optimistic-user' : null,
                resolvedBy: variables.resolved ? { id: 'optimistic-user', name: 'Resolving...', avatarUrl: null } : null
              }
            : comment,
        );
        return {
          ...old,
          items: updatedItems,
        };
      });
      return { previousComments };
    },
    onError: (err, variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(RQ_KEY(variables.pageId), context.previousComments);
      }
      notifications.show({
        message: t("Failed to resolve comment"),
        color: "red",
      });
    },
    onSuccess: (data: IComment, variables) => {
      const pageId = data.pageId;
      const currentComments = queryClient.getQueryData(
        RQ_KEY(pageId),
      ) as IPagination<IComment>;
      if (currentComments && currentComments.items) {
        const updatedComments = currentComments.items.map((comment) =>
          comment.id === variables.commentId
            ? { ...comment, resolvedAt: data.resolvedAt, resolvedById: data.resolvedById, resolvedBy: data.resolvedBy }
            : comment,
        );
        queryClient.setQueryData(RQ_KEY(pageId), {
          ...currentComments,
          items: updatedComments,
        });
      }
      emit({
        operation: "resolveComment",
        pageId: pageId,
        commentId: variables.commentId,
        resolved: variables.resolved,
        resolvedAt: data.resolvedAt,
        resolvedById: data.resolvedById,
        resolvedBy: data.resolvedBy,
      });
      queryClient.invalidateQueries({ queryKey: RQ_KEY(pageId) });
      notifications.show({ 
        message: variables.resolved 
          ? t("Comment resolved successfully") 
          : t("Comment re-opened successfully") 
      });
    },
  });
} 