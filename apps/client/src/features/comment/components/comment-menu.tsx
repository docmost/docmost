import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import {
  IconDots,
  IconEdit,
  IconLink,
  IconTrash,
  IconCircleCheck,
  IconCircleCheckFilled,
} from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";
import { useClipboard } from "@/hooks/use-clipboard";
import { getAppUrl } from "@/lib/config";

type CommentMenuProps = {
  commentId: string;
  onEditComment: () => void;
  onDeleteComment: () => void;
  onResolveComment?: () => void;
  canEdit?: boolean;
  canManage?: boolean;
  isResolved?: boolean;
  isParentComment?: boolean;
};

function CommentMenu({
  commentId,
  onEditComment,
  onDeleteComment,
  onResolveComment,
  canEdit = true,
  canManage = false,
  isResolved = false,
  isParentComment = false,
}: CommentMenuProps) {
  const { t } = useTranslation();
  const canResolve = useHasFeature(Feature.COMMENT_RESOLUTION);
  const upgradeLabel = useUpgradeLabel();
  const clipboard = useClipboard({ timeout: 500 });

  const handleCopyLink = () => {
    const link = `${getAppUrl()}${window.location.pathname}?commentId=${commentId}`;
    clipboard.copy(link);
    notifications.show({ message: t("Link copied") });
  };

  //@ts-ignore
  const openDeleteModal = () =>
    modals.openConfirmModal({
      title: t("Are you sure you want to delete this comment?"),
      centered: true,
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: onDeleteComment,
    });

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <ActionIcon
          variant="default"
          style={{ border: "none" }}
          aria-label={t("Comment menu")}
        >
          <IconDots size={20} stroke={2} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        {canEdit && (
          <Menu.Item
            onClick={onEditComment}
            leftSection={<IconEdit size={14} />}
          >
            {t("Edit comment")}
          </Menu.Item>
        )}
        {isParentComment &&
          canManage &&
          (canResolve ? (
            <Menu.Item
              onClick={onResolveComment}
              leftSection={
                isResolved ? (
                  <IconCircleCheckFilled size={14} />
                ) : (
                  <IconCircleCheck size={14} />
                )
              }
            >
              {isResolved ? t("Re-open comment") : t("Resolve comment")}
            </Menu.Item>
          ) : (
            <Tooltip label={upgradeLabel} position="left" withinPortal={false}>
              <Menu.Item disabled leftSection={<IconCircleCheck size={14} />}>
                {t("Resolve comment")}
              </Menu.Item>
            </Tooltip>
          ))}
        <Menu.Item
          leftSection={<IconLink size={14} />}
          onClick={handleCopyLink}
        >
          {t("Copy link")}
        </Menu.Item>
        {canManage && (
          <Menu.Item
            leftSection={<IconTrash size={14} />}
            onClick={openDeleteModal}
          >
            {t("Delete comment")}
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

export default CommentMenu;
