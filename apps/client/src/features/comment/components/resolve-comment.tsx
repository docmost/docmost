import { ActionIcon } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { useResolveCommentMutation } from "@/features/comment/queries/comment-query";
import { useTranslation } from "react-i18next";

function ResolveComment({ commentId, pageId, resolvedAt }) {
  const { t } = useTranslation();
  const resolveCommentMutation = useResolveCommentMutation();

  const isResolved = resolvedAt != null;
  const iconColor = isResolved ? "green" : "gray";

  //@ts-ignore
  const openConfirmModal = () =>
    modals.openConfirmModal({
      title: t("Are you sure you want to resolve this comment thread?"),
      centered: true,
      labels: { confirm: t("Confirm"), cancel: t("Cancel") },
      onConfirm: handleResolveToggle,
    });

  const handleResolveToggle = async () => {
    try {
      await resolveCommentMutation.mutateAsync({
        commentId,
        resolved: !isResolved,
      });
      //TODO: remove comment mark
      // Remove comment thread from state on resolve
    } catch (error) {
      console.error("Failed to toggle resolved state:", error);
    }
  };

  return (
    <ActionIcon
      onClick={openConfirmModal}
      variant="default"
      style={{ border: "none" }}
    >
      <IconCircleCheck size={20} stroke={2} color={iconColor} />
    </ActionIcon>
  );
}

export default ResolveComment;
