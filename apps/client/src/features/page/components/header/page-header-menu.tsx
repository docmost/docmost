import { ActionIcon, Group, Menu, Text, Tooltip } from "@mantine/core";
import {
  IconArrowRight,
  IconArrowsHorizontal,
  IconDots,
  IconFileExport,
  IconHistory,
  IconLink,
  IconList,
  IconMessage,
  IconPrinter,
  IconTrash,
  IconWifiOff,
} from "@tabler/icons-react";
import React, { useEffect } from "react";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import { useAtom } from "jotai";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms.ts";
import { useClipboard, useDisclosure } from "@mantine/hooks";
import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { notifications } from "@mantine/notifications";
import { getAppUrl } from "@/lib/config.ts";
import { extractPageSlugId } from "@/lib";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { PageWidthToggle } from "@/features/user/components/page-width-pref.tsx";
import { Trans, useTranslation } from "react-i18next";
import ExportModal from "@/components/common/export-modal";
import {
  pageEditorAtom,
  yjsConnectionStatusAtom,
} from "@/features/editor/atoms/editor-atoms.ts";
import { formattedDate, timeAgo } from "@/lib/time.ts";
import MovePageModal from "@/features/page/components/move-page-modal.tsx";
import { useTimeAgo } from "@/hooks/use-time-ago.tsx";
import ShareModal from '@/features/share/components/share-modal.tsx';

interface PageHeaderMenuProps {
  readOnly?: boolean;
}
export default function PageHeaderMenu({ readOnly }: PageHeaderMenuProps) {
  const { t } = useTranslation();
  const toggleAside = useToggleAside();
  const [yjsConnectionStatus] = useAtom(yjsConnectionStatusAtom);

  return (
    <>
      {yjsConnectionStatus === "disconnected" && (
        <Tooltip
          label={t("Real-time editor connection lost. Retrying...")}
          openDelay={250}
          withArrow
        >
          <ActionIcon variant="default" c="red" style={{ border: "none" }}>
            <IconWifiOff size={20} stroke={2} />
          </ActionIcon>
        </Tooltip>
      )}

      <ShareModal readOnly={readOnly}/>

      <Tooltip label={t("Comments")} openDelay={250} withArrow>
        <ActionIcon
          variant="default"
          style={{ border: "none" }}
          onClick={() => toggleAside("comments")}
        >
          <IconMessage size={20} stroke={2} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t("Table of contents")} openDelay={250} withArrow>
        <ActionIcon
          variant="default"
          style={{ border: "none" }}
          onClick={() => toggleAside("toc")}
        >
          <IconList size={20} stroke={2} />
        </ActionIcon>
      </Tooltip>

      <PageActionMenu readOnly={readOnly} />
    </>
  );
}

interface PageActionMenuProps {
  readOnly?: boolean;
}
function PageActionMenu({ readOnly }: PageActionMenuProps) {
  const { t } = useTranslation();
  const [, setHistoryModalOpen] = useAtom(historyAtoms);
  const clipboard = useClipboard({ timeout: 500 });
  const { pageSlug, spaceSlug } = useParams();
  const { data: page, isLoading } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const { openDeleteModal } = useDeletePageModal();
  const [tree] = useAtom(treeApiAtom);
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [
    movePageModalOpened,
    { open: openMovePageModal, close: closeMoveSpaceModal },
  ] = useDisclosure(false);
  const [pageEditor] = useAtom(pageEditorAtom);
  const pageUpdatedAt = useTimeAgo(page.updatedAt);

  const handleCopyLink = () => {
    const pageUrl =
      getAppUrl() + buildPageUrl(spaceSlug, page.slugId, page.title);

    clipboard.copy(pageUrl);
    notifications.show({ message: t("Link copied") });
  };

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const openHistoryModal = () => {
    setHistoryModalOpen(true);
  };

  const handleDeletePage = () => {
    openDeleteModal({ onConfirm: () => tree?.delete(page.id) });
  };

  return (
    <>
      <Menu
        shadow="xl"
        position="bottom-end"
        offset={20}
        width={230}
        withArrow
        arrowPosition="center"
      >
        <Menu.Target>
          <ActionIcon variant="default" style={{ border: "none" }}>
            <IconDots size={20} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconLink size={16} />}
            onClick={handleCopyLink}
          >
            {t("Copy link")}
          </Menu.Item>
          <Menu.Divider />

          <Menu.Item leftSection={<IconArrowsHorizontal size={16} />}>
            <Group wrap="nowrap">
              <PageWidthToggle label={t("Full width")} />
            </Group>
          </Menu.Item>

          <Menu.Item
            leftSection={<IconHistory size={16} />}
            onClick={openHistoryModal}
          >
            {t("Page history")}
          </Menu.Item>

          <Menu.Divider />

          {!readOnly && (
            <Menu.Item
              leftSection={<IconArrowRight size={16} />}
              onClick={openMovePageModal}
            >
              {t("Move")}
            </Menu.Item>
          )}

          <Menu.Item
            leftSection={<IconFileExport size={16} />}
            onClick={openExportModal}
          >
            {t("Export")}
          </Menu.Item>

          <Menu.Item
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
          >
            {t("Print PDF")}
          </Menu.Item>

          {!readOnly && (
            <>
              <Menu.Divider />
              <Menu.Item
                color={"red"}
                leftSection={<IconTrash size={16} />}
                onClick={handleDeletePage}
              >
                {t("Delete")}
              </Menu.Item>
            </>
          )}

          <Menu.Divider />

          <>
            <Group px="sm" wrap="nowrap" style={{ cursor: "pointer" }}>
              <Tooltip
                label={t("Edited by {{name}} {{time}}", {
                  name: page.lastUpdatedBy.name,
                  time: pageUpdatedAt,
                })}
                position="left-start"
              >
                <div style={{ width: 210 }}>
                  <Text size="xs" c="dimmed" truncate="end">
                    {t("Word count: {{wordCount}}", {
                      wordCount: pageEditor?.storage?.characterCount?.words(),
                    })}
                  </Text>

                  <Text size="xs" c="dimmed" lineClamp={1}>
                    <Trans
                      defaults="Created by: <b>{{creatorName}}</b>"
                      values={{ creatorName: page?.creator?.name }}
                      components={{ b: <Text span fw={500} /> }}
                    />
                  </Text>
                  <Text size="xs" c="dimmed" truncate="end">
                    {t("Created at: {{time}}", {
                      time: formattedDate(page.createdAt),
                    })}
                  </Text>
                </div>
              </Tooltip>
            </Group>
          </>
        </Menu.Dropdown>
      </Menu>

      <ExportModal
        type="page"
        id={page.id}
        open={exportOpened}
        onClose={closeExportModal}
      />

      <MovePageModal
        pageId={page.id}
        slugId={page.slugId}
        currentSpaceSlug={spaceSlug}
        onClose={closeMoveSpaceModal}
        open={movePageModalOpened}
      />
    </>
  );
}
