import React, { useState } from "react";
import { Dialog, Group, Stack, Text } from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import { useAtom } from "jotai";
import {
  activeCommentIdAtom,
  readOnlyCommentDataAtom,
  showReadOnlyCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import CommentEditor from "@/features/comment/components/comment-editor";
import CommentActions from "@/features/comment/components/comment-actions";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { useCreateReadOnlyCommentMutation } from "@/features/comment/queries/comment-query";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { useEditor } from "@tiptap/react";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { useTranslation } from "react-i18next";
import { useQueryEmit } from "@/features/websocket/use-query-emit";

type ReadOnlyCommentDialogProps = {
  editor: ReturnType<typeof useEditor>;
  pageId: string;
};

function ReadOnlyCommentDialog({ editor, pageId }: ReadOnlyCommentDialogProps) {
  const { t } = useTranslation();
  const [comment, setComment] = useState("");
  const [, setShowReadOnlyCommentPopup] = useAtom(showReadOnlyCommentPopupAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const [readOnlyCommentData, setReadOnlyCommentData] = useAtom(
    readOnlyCommentDataAtom,
  );
  const [currentUser] = useAtom(currentUserAtom);
  const [, setAsideState] = useAtom(asideStateAtom);
  const useClickOutsideRef = useClickOutside(() => {
    handleDialogClose();
  });
  const createCommentMutation = useCreateReadOnlyCommentMutation();
  const { isPending } = createCommentMutation;

  const emit = useQueryEmit();

  const handleDialogClose = () => {
    setShowReadOnlyCommentPopup(false);
    setReadOnlyCommentData(null);
  };

  const handleAddComment = async () => {
    if (!readOnlyCommentData) return;

    try {
      const commentData = {
        pageId: pageId,
        content: JSON.stringify(comment),
        selection: readOnlyCommentData.selectedText,
        yjsSelection: readOnlyCommentData.yjsSelection,
      };

      const createdComment =
        await createCommentMutation.mutateAsync(commentData);

      setActiveCommentId(createdComment.id);
      setAsideState({ tab: "comments", isAsideOpen: true });

      setTimeout(() => {
        const selector = `div[data-comment-id="${createdComment.id}"]`;
        const commentElement = document.querySelector(selector);
        commentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);

      emit({
        operation: "invalidateComment",
        pageId: pageId,
      });
    } finally {
      setShowReadOnlyCommentPopup(false);
      setReadOnlyCommentData(null);
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

export default ReadOnlyCommentDialog;
