import { ActionIcon } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';

import useComment from '@/features/comment/hooks/use-comment';
import { useAtom } from 'jotai';
import { commentsAtom } from '@/features/comment/atoms/comment-atom';
import { modals } from '@mantine/modals';

function ResolveComment({ commentId, pageId, resolvedAt }) {
  const [, setComments] = useAtom(commentsAtom(pageId));
  const { resolveCommentMutation } = useComment();
  const isResolved = resolvedAt != null;
  const iconColor = isResolved ? 'green' : 'gray';

  //@ts-ignore
  const openConfirmModal = () =>
    modals.openConfirmModal({
      title: 'Are you sure you want to resolve this comment thread?',
      centered: true,
      labels: { confirm: 'Confirm', cancel: 'Cancel' },
      onConfirm: handleResolveToggle,
    });

  const handleResolveToggle = async () => {
    try {
      const resolvedComment = await resolveCommentMutation.mutateAsync({ commentId, resolved: !isResolved });
      //TODO: remove comment mark
      // Remove comment thread from state on resolve

      setComments((oldComments) =>
        oldComments.map((comment) =>
          comment.id === commentId
            ? { ...comment, resolvedAt: resolvedComment.resolvedAt, resolvedById: resolvedComment.resolvedById }
            : comment,
        ),
      );
    } catch (error) {
      console.error('Failed to toggle resolved state:', error);
    }
  };

  return (
    <ActionIcon onClick={openConfirmModal} variant="default" style={{ border: 'none' }}>
      <IconCircleCheck size={20} stroke={2} color={iconColor} />
    </ActionIcon>
  );
}

export default ResolveComment;
