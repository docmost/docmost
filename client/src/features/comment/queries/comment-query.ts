import { useMutation, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import {
  createComment,
  deleteComment, getPageComments,
  resolveComment,
  updateComment,
} from '@/features/comment/services/comment-service';
import { IComment, IResolveComment } from '@/features/comment/types/comment.types';
import { notifications } from '@mantine/notifications';

export const RQ_KEY = (pageId: string) => ['comments', pageId];

export function useCommentsQuery(pageId: string): UseQueryResult<IComment[], Error> {
  return useQuery({
    queryKey: RQ_KEY(pageId),
    queryFn: () => getPageComments(pageId),
    enabled: !!pageId,
  });
}

export function useCreateCommentMutation() {
  const queryClient = useQueryClient();

  return useMutation<IComment, Error, Partial<IComment>>({
    mutationFn: (data) => createComment(data),
    onSuccess: (data) => {
      const newComment = data;
      let comments = queryClient.getQueryData(RQ_KEY(data.pageId));
      if (comments) {
        comments = prevComments => [...prevComments, newComment];
        queryClient.setQueryData(RQ_KEY(data.pageId), comments);
      }

      notifications.show({ message: 'Comment created successfully' });
    },
    onError: (error) => {
      notifications.show({ message: 'Error creating comment', color: 'red' });
    },
  });
}

export function useUpdateCommentMutation() {
  return useMutation<IComment, Error, Partial<IComment>>({
    mutationFn: (data) => updateComment(data),
    onSuccess: (data) => {
      notifications.show({ message: 'Comment updated successfully' });
    },
    onError: (error) => {
      notifications.show({ message: 'Failed to update comment', color: 'red' });
    },
  });
}

export function useDeleteCommentMutation(pageId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (data, variables) => {
      let comments = queryClient.getQueryData(RQ_KEY(pageId)) as IComment[];
      if (comments) {
        comments = comments.filter(comment => comment.id !== variables);
        queryClient.setQueryData(RQ_KEY(pageId), comments);
      }
      notifications.show({ message: 'Comment deleted successfully' });
    },
    onError: (error) => {
      notifications.show({ message: 'Failed to delete comment', color: 'red' });
    },
  });
}

export function useResolveCommentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IResolveComment) => resolveComment(data),
    onSuccess: (data: IComment, variables) => {

      const currentComments = queryClient.getQueryData(RQ_KEY(data.pageId)) as IComment[];

      if (currentComments) {
        const updatedComments = currentComments.map((comment) =>
          comment.id === variables.commentId ? { ...comment, ...data } : comment,
        );
        queryClient.setQueryData(RQ_KEY(data.pageId), updatedComments);
      }

      notifications.show({ message: 'Comment resolved successfully' });
    },
    onError: (error) => {
      notifications.show({ message: 'Failed to resolve comment', color: 'red' });
    },
  });
}

