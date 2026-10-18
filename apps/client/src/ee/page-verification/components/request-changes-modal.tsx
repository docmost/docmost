import { useState } from "react";
import { Button, Group, Modal, Stack, Textarea } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useRejectApprovalMutation } from "@/ee/page-verification/queries/page-verification-query";

// Matches the server limit on rejection comments.
const MAX_COMMENT_LENGTH = 500;

type RequestChangesModalProps = {
  pageId: string;
  opened: boolean;
  onClose: () => void;
  onDone?: () => void;
};

export function RequestChangesModal({
  pageId,
  opened,
  onClose,
  onDone,
}: RequestChangesModalProps) {
  const { t } = useTranslation();
  const rejectMutation = useRejectApprovalMutation();
  const [comment, setComment] = useState("");

  const handleClose = () => {
    setComment("");
    onClose();
  };

  const handleSubmit = () => {
    rejectMutation.mutate(
      { pageId, comment: comment.trim() },
      {
        onSuccess: () => {
          setComment("");
          onClose();
          onDone?.();
        },
      },
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Request changes")}
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      <Stack>
        <Textarea
          label={t("Comment")}
          placeholder={t("Explain what needs to change...")}
          value={comment}
          onChange={(event) => setComment(event.currentTarget.value)}
          minRows={3}
          resize="vertical"
          maxLength={MAX_COMMENT_LENGTH}
          variant="filled"
          data-autofocus
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={handleClose}>
            {t("Cancel")}
          </Button>
          <Button
            color="dark"
            onClick={handleSubmit}
            disabled={!comment.trim()}
            loading={rejectMutation.isPending}
          >
            {t("Request changes")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
