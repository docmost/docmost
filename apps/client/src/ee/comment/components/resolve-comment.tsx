import { ActionIcon, Tooltip } from "@mantine/core";
import { IconCircleCheck, IconCircleCheckFilled } from "@tabler/icons-react";
import { useResolveCommentMutation } from "@/ee/comment/queries/comment-query";
import { useTranslation } from "react-i18next";

interface ResolveCommentProps {
  commentId: string;
  pageId: string;
  resolvedAt?: Date;
}

function ResolveComment({ commentId, pageId, resolvedAt }: ResolveCommentProps) {
  const { t } = useTranslation();
  const resolveCommentMutation = useResolveCommentMutation();

  const isResolved = resolvedAt != null;
  const iconColor = isResolved ? "green" : "gray";

  const handleResolveToggle = async () => {
    try {
      await resolveCommentMutation.mutateAsync({
        commentId,
        pageId,
        resolved: !isResolved,
      });
    } catch (error) {
      console.error("Failed to toggle resolved state:", error);
    }
  };

  return (
    <Tooltip 
      label={isResolved ? t("Re-Open comment") : t("Resolve comment")}
      position="top"
    >
      <ActionIcon
        onClick={handleResolveToggle}
        variant="subtle"
        color={isResolved ? "green" : "gray"}
        size="sm"
        loading={resolveCommentMutation.isPending}
        disabled={resolveCommentMutation.isPending}
      >
        {isResolved ? (
          <IconCircleCheckFilled size={18} />
        ) : (
          <IconCircleCheck size={18} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}

export default ResolveComment; 