import React, { useState } from "react";
import { Dialog, Group, Stack, Text } from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import { useAtom } from "jotai";
import {
  activeCommentIdAtom,
  draftCommentIdAtom,
  showCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import CommentEditor from "@/features/comment/components/comment-editor";
import CommentActions from "@/features/comment/components/comment-actions";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { useCreateCommentMutation } from "@/features/comment/queries/comment-query";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { useEditor } from "@tiptap/react";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { useTranslation } from "react-i18next";
import { useQueryEmit } from "@/features/websocket/use-query-emit";

interface CommentDialogProps {
  editor: ReturnType<typeof useEditor>;
  pageId: string;
}

function CommentDialog({ editor, pageId }: CommentDialogProps) {
  const { t } = useTranslation();
  const [comment, setComment] = useState("");
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

  const emit = useQueryEmit();

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
        pageId: pageId,
        content: JSON.stringify(comment),
        selection: selectedText,
      };

      const createdComment =
        await createCommentMutation.mutateAsync(commentData);
      editor
        .chain()
        .setComment(createdComment.id)
        .unsetCommentDecoration()
        .run();
      setActiveCommentId(createdComment.id);

      //unselect text to close bubble menu
      editor.commands.setTextSelection({ from: editor.view.state.selection.from, to: editor.view.state.selection.from });

      setAsideState({ tab: "comments", isAsideOpen: true });
      setTimeout(() => {
        const selector = `div[data-comment-id="${createdComment.id}"]`;
        const commentElement = document.querySelector(selector);
        commentElement?.scrollIntoView({ behavior: "smooth", block: "center" });

        editor.view.dispatch(
          editor.state.tr.scrollIntoView()
        );
      }, 400);

      emit({
        operation: "invalidateComment",
        pageId: pageId,
      });
    } finally {
      setShowCommentPopup(false);
      setDraftCommentId("");
    }
  };

  const handleCommentEditorChange = (newContent: any) => {
    setComment(newContent);
  };

  return (
    <Dialog
      opened={true}
      onClose={handleDialogClose}
      ref={useClickOutsideRef}
      size="lg"
      radius="md"
      w={300}
      position={{ bottom: 500, right: 50 }}
      withCloseButton
      withBorder
    >
      <Stack gap={2}>
        <Group>
          <CustomAvatar
            size="sm"
            avatarUrl={currentUser.user.avatarUrl}
            name={currentUser.user.name}
          />
          <div style={{ flex: 1 }}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" fw={500} lineClamp={1}>
                {currentUser.user.name}
              </Text>
            </Group>
          </div>
        </Group>

        <CommentEditor
          onUpdate={handleCommentEditorChange}
          onSave={handleAddComment}
          placeholder={t("Write a comment")}
          editable={true}
          autofocus={true}
        />
        <CommentActions onSave={handleAddComment} isLoading={isPending} />
      </Stack>
    </Dialog>
  );
}

export default CommentDialog;
