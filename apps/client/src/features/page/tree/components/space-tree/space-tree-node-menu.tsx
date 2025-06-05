import { NodeApi, TreeApi } from "react-arborist";
import { useParams } from "react-router-dom";
import { ActionIcon, Menu, rem } from "@mantine/core";
import {
  IconArrowRight,
  IconDots,
  IconFileExport,
  IconFileSymlink,
  IconLink,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { useClipboard, useDisclosure } from "@mantine/hooks";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { notifications } from "@mantine/notifications";
import { getAppUrl } from "@/lib/config.ts";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { useTranslation } from "react-i18next";
import ExportModal from "@/components/common/export-modal";
import PageShareModal from "@/features/page/components/share-modal";
import MovePageModal from "@/features/page/components/move-page-modal.tsx";
import CreateSyncPageModal from "@/features/page/components/create-sync-page-modal.tsx";

interface NodeMenuProps {
  node: NodeApi<SpaceTreeNode>;
  treeApi: TreeApi<SpaceTreeNode>;
}

export function NodeMenu({ node, treeApi }: NodeMenuProps) {
  const { t } = useTranslation();
  const clipboard = useClipboard({ timeout: 500 });
  const { spaceSlug } = useParams();
  const { openDeleteModal } = useDeletePageModal();

  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [shareOpened, { open: openShareModal, close: closeShareModal }] =
    useDisclosure(false);

  const [
    movePageModalOpened,
    { open: openMovePageModal, close: closeMoveSpaceModal },
  ] = useDisclosure(false);

  const [
    createSyncedPageModelOpened,
    { open: openCreateSyncedPageModal, close: closeCreateSyncedPageModal },
  ] = useDisclosure(false);

  const handleCopyLink = () => {
    const pageUrl =
      getAppUrl() + buildPageUrl(spaceSlug, node.data.slugId, node.data.name);
    clipboard.copy(pageUrl);
    notifications.show({ message: t("Link copied") });
  };

  return (
    <>
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <ActionIcon
            variant="transparent"
            size={18}
            c="gray"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <IconDots style={{ width: rem(20), height: rem(20) }} stroke={2} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconLink size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopyLink();
            }}
          >
            {t("Copy link")}
          </Menu.Item>

          <Menu.Item
            leftSection={<IconFileExport size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openExportModal();
            }}
          >
            {t("Export page")}
          </Menu.Item>

          <Menu.Item
            leftSection={<IconUsers size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openShareModal();
            }}
          >
            {t("Share")}
          </Menu.Item>

          {!node.data.isSynced ? (
            <Menu.Item
              leftSection={<IconFileSymlink size={16} />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openCreateSyncedPageModal();
              }}
            >
              {t("New Synced Page")}
            </Menu.Item>
          ) : null}

          {!(treeApi.props.disableEdit as boolean) && (
            <>
              <Menu.Item
                leftSection={<IconArrowRight size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openMovePageModal();
                }}
              >
                {t("Move")}
              </Menu.Item>

              <Menu.Divider />
              <Menu.Item
                c="red"
                leftSection={<IconTrash size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openDeleteModal({ onConfirm: () => treeApi?.delete(node) });
                }}
              >
                {t("Delete")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <MovePageModal
        pageId={node.id}
        slugId={node.data.slugId}
        currentSpaceSlug={spaceSlug}
        onClose={closeMoveSpaceModal}
        open={movePageModalOpened}
      />

      <CreateSyncPageModal
        originPageId={node.id}
        onClose={closeCreateSyncedPageModal}
        open={createSyncedPageModelOpened}
      />

      <ExportModal
        type="page"
        id={node.id}
        open={exportOpened}
        onClose={closeExportModal}
      />

      <PageShareModal
        pageId={node.id}
        opened={shareOpened}
        onClose={closeShareModal}
      />
    </>
  );
}
