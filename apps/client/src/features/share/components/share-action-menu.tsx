import { Menu, ActionIcon, Text } from "@mantine/core";
import React from "react";
import {
  IconCopy,
  IconDots,
  IconFileDescription,
  IconTrash,
} from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import { ISharedItem } from "@/features/share/types/share.types.ts";
import {
  buildPageUrl,
  buildSharedPageUrl,
} from "@/features/page/page.utils.ts";
import { useClipboard } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import { useDeleteShareMutation } from "@/features/share/queries/share-query.ts";

interface Props {
  share: ISharedItem;
}
export default function ShareActionMenu({ share }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clipboard = useClipboard();
  const deleteShareMutation = useDeleteShareMutation();

  const openPage = () => {
    const pageLink = buildPageUrl(
      share.space.slug,
      share.page.slugId,
      share.page.title,
    );
    navigate(pageLink);
  };

  const copyLink = () => {
    const shareLink = buildSharedPageUrl({
      shareId: share.key,
      pageTitle: share.page.title,
      pageSlugId: share.page.slugId,
    });

    clipboard.copy(shareLink);
    notifications.show({ message: t("Link copied") });
  };
  const onDelete = async () => {
    deleteShareMutation.mutateAsync(share.key);
  };

  const openDeleteModal = () =>
    modals.openConfirmModal({
      title: t("Delete public share link"),
      children: (
        <Text size="sm">
          {t("Are you sure you want to delete this shared link?")}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Delete"), cancel: t("Don't") },
      confirmProps: { color: "red" },
      onConfirm: onDelete,
    });

  return (
    <>
      <Menu
        shadow="xl"
        position="bottom-end"
        offset={20}
        width={200}
        withArrow
        arrowPosition="center"
      >
        <Menu.Target>
          <ActionIcon variant="subtle" c="gray">
            <IconDots size={20} stroke={2} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item onClick={copyLink} leftSection={<IconCopy size={16} />}>
            {t("Copy link")}
          </Menu.Item>

          <Menu.Item
            onClick={openPage}
            leftSection={<IconFileDescription size={16} />}
          >
            {t("Open page")}
          </Menu.Item>
          <Menu.Item
            c="red"
            onClick={openDeleteModal}
            leftSection={<IconTrash size={16} />}
            disabled={share.space?.userRole === "reader"}
          >
            {t("Delete share")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}
