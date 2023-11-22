import React, { useState } from 'react';
import { Avatar, Dialog, Group, Stack, Text } from '@mantine/core';
import { useClickOutside } from '@mantine/hooks';
import { useAtom } from 'jotai';
import {
  activeCommentIdAtom,
  draftCommentIdAtom,
  showCommentPopupAtom,
} from '@/features/comment/atoms/comment-atom';
import { Editor } from '@tiptap/core';
import CommentEditor from '@/features/comment/components/comment-editor';
import CommentActions from '@/features/comment/components/comment-actions';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { useCreateCommentMutation } from '@/features/comment/queries/comment-query';
import { asideStateAtom } from '@/components/navbar/atoms/sidebar-atom';

interface CommentDialogProps {
  editor: Editor,
  pageId: string,
}

function CommentDialog({ editor, pageId }: CommentDialogProps) {
  const [comment, setComment] = useState('');
  const [, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const [draftCommentId, setDraftCommentId] = useAtom(draftCommentIdAtom);
  const [currentUser] = useAtom(currentUserAtom);
  const [, setAsideState] = useAtom(asideStateAtom);
  const useClickOutsideRef = useClickOutside(() => {
    handleDialogClose();
  });
  const createCommentMutation = useCreateCommentMutation();
  const { isPending } = createCommentMutation;

  const handleDialogClose = () => {
    setShowCommentPopup(false);
    editor.chain().focus().unsetCommentDecoration().run();
  };

  const getSelectedText = () => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to);
  };

  const handleAddComment = async () => {
    try {
      const selectedText = getSelectedText();
      const commentData = {
        id: draftCommentId,
        pageId: pageId,
        content: JSON.stringify(comment),
        selection: selectedText,
      };

      const createdComment = await createCommentMutation.mutateAsync(commentData);
      editor.chain().setComment(createdComment.id).unsetCommentDecoration().run();
      setActiveCommentId(createdComment.id);

      setAsideState({ tab: 'comments', isAsideOpen: true });
      setTimeout(() => {
        const selector = `div[data-comment-id="${createdComment.id}"]`;
        const commentElement = document.querySelector(selector);
        commentElement?.scrollIntoView();
      });
    } finally {
      setShowCommentPopup(false);
      setDraftCommentId('');
    }
  };

  const handleCommentEditorChange = (newContent) => {
    setComment(newContent);
  };

  return (
    <Dialog opened={true} onClose={handleDialogClose} ref={useClickOutsideRef} size="lg" radius="md"
            w={300} position={{ bottom: 500, right: 50 }} withCloseButton withBorder>

      <Stack gap={2}>
        <Group>
          <Avatar size="sm" color="blue">{currentUser.user.name.charAt(0)}</Avatar>
          <div style={{ flex: 1 }}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" fw={500} lineClamp={1}>{currentUser.user.name}</Text>
            </Group>
          </div>
        </Group>

        <CommentEditor onUpdate={handleCommentEditorChange} placeholder="Write a comment"
                       editable={true} autofocus={true}
        />
        <CommentActions onSave={handleAddComment} isLoading={isPending}
        />
      </Stack>
    </Dialog>
  );
}

export default CommentDialog;
