import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  createComment,
  deleteComment,
  resolveComment,
  updateComment,
} from '@/features/comment/services/comment-service';
import { IComment, IResolveComment } from '@/features/comment/types/comment.types';

export default function useComment() {

  const createMutation = useMutation(
    (data: Partial<IComment>) => createComment(data),
    {
      onSuccess: (data: IComment) => {
        toast.success('Comment created successfully');
      },
      onError: (error) => {
        toast.error(`Error creating comment: ${error.message}`);
      },
    },
  );

  const updateMutation = useMutation(
    (data: Partial<IComment>) => updateComment(data),
    {
      onSuccess: (data: IComment) => {
        toast.success('Comment updated successfully');
      },
      onError: (error) => {
        toast.error(`Error updating comment: ${error.message}`);
      },
    },
  );

  const resolveMutation = useMutation(
    (data: IResolveComment) => resolveComment(data),
    {
      onError: (error) => {
        toast.error(`Failed to perform resolve action: ${error.message}`);
      },
    },
  );

  const deleteMutation = useMutation(
    (id: string) => deleteComment(id),
    {
      onSuccess: () => {
        toast.success('Comment deleted successfully');
      },
      onError: (error) => {
        toast.error(`Error deleting comment: ${error.message}`);
      },
    },
  );

  return {
    createCommentMutation: createMutation,
    updateCommentMutation: updateMutation,
    resolveCommentMutation: resolveMutation,
    deleteCommentMutation: deleteMutation.mutateAsync,
  };
}
