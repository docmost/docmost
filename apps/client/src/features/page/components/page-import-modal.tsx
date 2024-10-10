import { Modal, Button, SimpleGrid, FileButton } from "@mantine/core";
import {
  IconCheck,
  IconFileCode,
  IconMarkdown,
  IconX,
} from "@tabler/icons-react";
import { importPage } from "@/features/page/services/page-service.ts";
import { notifications } from "@mantine/notifications";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { useAtom } from "jotai";
import { buildTree } from "@/features/page/tree/utils";
import { IPage } from "@/features/page/types/page.types.ts";
import React from "react";
import { useTranslation } from "react-i18next";

interface PageImportModalProps {
  spaceId: string;
  open: boolean;
  onClose: () => void;
}

export default function PageImportModal({
  spaceId,
  open,
  onClose,
}: PageImportModalProps) {
  const { t } = useTranslation();
  return (
    <>
      <Modal.Root
        opened={open}
        onClose={onClose}
        size={600}
        padding="xl"
        yOffset="10vh"
        xOffset={0}
        mah={400}
      >
        <Modal.Overlay />
        <Modal.Content style={{ overflow: "hidden" }}>
          <Modal.Header py={0}>
            <Modal.Title fw={500}>{t("Import pages")}</Modal.Title>
            <Modal.CloseButton />
          </Modal.Header>
          <Modal.Body>
            <ImportFormatSelection spaceId={spaceId} onClose={onClose} />
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}

interface ImportFormatSelection {
  spaceId: string;
  onClose: () => void;
}
function ImportFormatSelection({ spaceId, onClose }: ImportFormatSelection) {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useAtom(treeDataAtom);

  const handleFileUpload = async (selectedFiles: File[]) => {
    if (!selectedFiles) {
      return;
    }

    onClose();

    const alert = notifications.show({
      title: t("Importing pages"),
      message: t("Page import is in progress. Please do not close this tab."),
      loading: true,
      autoClose: false,
    });

    const pages: IPage[] = [];
    let pageCount = 0;

    for (const file of selectedFiles) {
      try {
        const page = await importPage(file, spaceId);
        pages.push(page);
        pageCount += 1;
      } catch (err) {
        console.log("Failed to import page", err);
      }
    }

    if (pages?.length > 0 && pageCount > 0) {
      const newTreeNodes = buildTree(pages);
      const fullTree = treeData.concat(newTreeNodes);

      if (newTreeNodes?.length && fullTree?.length > 0) {
        setTreeData(fullTree);
      }

      const pageCountText =
        pageCount === 1 ? `1 ${t("page")}` : `${pageCount} ${t("pages")}`;

      notifications.update({
        id: alert,
        color: "teal",
        title: `${t("Successfully imported")} ${pageCountText}`,
        message: t("Your import is complete."),
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 5000,
      });
    } else {
      notifications.update({
        id: alert,
        color: "red",
        title: t("Failed to import pages"),
        message: t("Unable to import pages. Please try again."),
        icon: <IconX size={18} />,
        loading: false,
        autoClose: 5000,
      });
    }
  };

  return (
    <>
      <SimpleGrid cols={2}>
        <FileButton onChange={handleFileUpload} accept="text/markdown" multiple>
          {(props) => (
            <Button
              justify="start"
              variant="default"
              leftSection={<IconMarkdown size={18} />}
              {...props}
            >
              Markdown
            </Button>
          )}
        </FileButton>

        <FileButton onChange={handleFileUpload} accept="text/html" multiple>
          {(props) => (
            <Button
              justify="start"
              variant="default"
              leftSection={<IconFileCode size={18} />}
              {...props}
            >
              HTML
            </Button>
          )}
        </FileButton>
      </SimpleGrid>
    </>
  );
}
