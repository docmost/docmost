import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
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

export const RQ_KEY = (pageId: string) => ["comments", pageId];

export function useCommentsQuery(
  params: ICommentParams,
): UseQueryResult<IPagination<IComment>, Error> {
  return useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: RQ_KEY(params.pageId),
    queryFn: () => getPageComments(params),
    enabled: !!params.pageId,
  });
}

export function useCreateCommentMutation() {
  const queryClient = useQueryClient();

  return useMutation<IComment, Error, Partial<IComment>>({
    mutationFn: (data) => createComment(data),
    onSuccess: (data) => {
      //const newComment = data;
      // let comments = queryClient.getQueryData(RQ_KEY(data.pageId));
      // if (comments) {
      //comments = prevComments => [...prevComments, newComment];
      //queryClient.setQueryData(RQ_KEY(data.pageId), comments);
      //}

      queryClient.invalidateQueries({ queryKey: RQ_KEY(data.pageId) });
      notifications.show({ message: "Comment created successfully" });
    },
    onError: (error) => {
      notifications.show({ message: "Error creating comment", color: "red" });
    },
  });
}

export function useUpdateCommentMutation() {
  return useMutation<IComment, Error, Partial<IComment>>({
    mutationFn: (data) => updateComment(data),
    onSuccess: (data) => {
      notifications.show({ message: "Comment updated successfully" });
    },
    onError: (error) => {
      notifications.show({ message: "Failed to update comment", color: "red" });
    },
  });
}

export function useDeleteCommentMutation(pageId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (data, variables) => {
      const comments = queryClient.getQueryData(
        RQ_KEY(pageId),
      ) as IPagination<IComment>;

      if (comments && comments.items) {
        const commentId = variables;
        const newComments = comments.items.filter(
          (comment) => comment.id !== commentId,
        );
        queryClient.setQueryData(RQ_KEY(pageId), {
          ...comments,
          items: newComments,
        });
      }

      notifications.show({ message: "Comment deleted successfully" });
    },
    onError: (error) => {
      notifications.show({ message: "Failed to delete comment", color: "red" });
    },
  });
}

export function useResolveCommentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IResolveComment) => resolveComment(data),
    onSuccess: (data: IComment, variables) => {
      const currentComments = queryClient.getQueryData(
        RQ_KEY(data.pageId),
      ) as IComment[];

      /*
      if (currentComments) {
        const updatedComments = currentComments.map((comment) =>
          comment.id === variables.commentId
            ? { ...comment, ...data }
            : comment,
        );
        queryClient.setQueryData(RQ_KEY(data.pageId), updatedComments);
      }*/

      notifications.show({ message: "Comment resolved successfully" });
    },
    onError: (error) => {
      notifications.show({
        message: "Failed to resolve comment",
        color: "red",
      });
    },
  });
}
