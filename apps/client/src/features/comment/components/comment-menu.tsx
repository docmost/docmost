import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { IconDots, IconEdit, IconTrash, IconCircleCheck, IconCircleCheckFilled } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import { useIsCloudEE } from "@/hooks/use-is-cloud-ee";

type CommentMenuProps = {
  onEditComment: () => void;
  onDeleteComment: () => void;
  onResolveComment?: () => void;
  canEdit?: boolean;
  isResolved?: boolean;
  isParentComment?: boolean;
};

function CommentMenu({ 
  onEditComment, 
  onDeleteComment, 
  onResolveComment,
  canEdit = true,
  isResolved = false,
  isParentComment = false
}: CommentMenuProps) {
  const { t } = useTranslation();
  const isCloudEE = useIsCloudEE();

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
        <ActionIcon variant="default" style={{ border: "none" }}>
          <IconDots size={20} stroke={2} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        {canEdit && (
          <Menu.Item onClick={onEditComment} leftSection={<IconEdit size={14} />}>
            {t("Edit comment")}
          </Menu.Item>
        )}
        {isParentComment && (
          isCloudEE ? (
            <Menu.Item 
              onClick={onResolveComment} 
              leftSection={
                isResolved ? 
                  <IconCircleCheckFilled size={14} /> : 
                  <IconCircleCheck size={14} />
              }
            >
              {isResolved ? t("Re-open comment") : t("Resolve comment")}
            </Menu.Item>
          ) : (
            <Tooltip label={t("Available in enterprise edition")} position="left">
              <Menu.Item 
                disabled
                leftSection={<IconCircleCheck size={14} />}
              >
                {t("Resolve comment")}
              </Menu.Item>
            </Tooltip>
          )
        )}
        <Menu.Item
          leftSection={<IconTrash size={14} />}
          onClick={openDeleteModal}
        >
          {t("Delete comment")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export default CommentMenu;
