import {
  Modal,
  Button,
  SimpleGrid,
  FileButton,
  Group,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconBrandNotion,
  IconCheck,
  IconFileCode,
  IconFileTypeZip,
  IconMarkdown,
  IconX,
} from "@tabler/icons-react";
import {
  importPage,
  importZip,
} from "@/features/page/services/page-service.ts";
import { notifications } from "@mantine/notifications";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { useAtom } from "jotai";
import { buildTree } from "@/features/page/tree/utils";
import { IPage } from "@/features/page/types/page.types.ts";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfluenceIcon } from "@/components/icons/confluence-icon.tsx";
import { getFileImportSizeLimit, isCloud } from "@/lib/config.ts";
import { formatBytes } from "@/lib";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { getFileTaskById } from "@/features/file-task/services/file-task-service.ts";
import { queryClient } from "@/main.tsx";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";

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
        keepMounted={true}
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
  const [workspace] = useAtom(workspaceAtom);
  const [fileTaskId, setFileTaskId] = useState<string | null>(null);
  const emit = useQueryEmit();

  const canUseConfluence = isCloud() || workspace?.hasLicenseKey;

  const handleZipUpload = async (selectedFile: File, source: string) => {
    if (!selectedFile) {
      return;
    }

    try {
      onClose();

      notifications.show({
        id: "import",
        title: t("Uploading import file"),
        message: t("Please don't close this tab."),
        loading: true,
        withCloseButton: false,
        autoClose: false,
      });

      const importTask = await importZip(selectedFile, spaceId, source);
      notifications.update({
        id: "import",
        title: t("Importing pages"),
        message: t(
          "Page import is in progress. You can check back later if this takes longer.",
        ),
        loading: true,
        withCloseButton: true,
        autoClose: false,
      });

      setFileTaskId(importTask.id);
    } catch (err) {
      console.log("Failed to upload import file", err);
      notifications.update({
        id: "import",
        color: "red",
        title: t("Failed to upload import file"),
        message: err?.response.data.message,
        icon: <IconX size={18} />,
        loading: false,
        withCloseButton: true,
        autoClose: false,
      });
    }
  };

  useEffect(() => {
    if (!fileTaskId) return;

    const intervalId = setInterval(async () => {
      try {
        const fileTask = await getFileTaskById(fileTaskId);
        const status = fileTask.status;

        if (status === "success") {
          notifications.update({
            id: "import",
            color: "teal",
            title: t("Import complete"),
            message: t("Your pages were successfully imported."),
            icon: <IconCheck size={18} />,
            loading: false,
            withCloseButton: true,
            autoClose: false,
          });
          clearInterval(intervalId);
          setFileTaskId(null);

          await queryClient.refetchQueries({
            queryKey: ["root-sidebar-pages", fileTask.spaceId],
          });

          setTimeout(() => {
            emit({
              operation: "refetchRootTreeNodeEvent",
              spaceId: spaceId,
            });
          }, 50);
        }

        if (status === "failed") {
          notifications.update({
            id: "import",
            color: "red",
            title: t("Page import failed"),
            message: t(
              "Something went wrong while importing pages: {{reason}}.",
              {
                reason: fileTask.errorMessage,
              },
            ),
            icon: <IconX size={18} />,
            loading: false,
            withCloseButton: true,
            autoClose: false,
          });
          clearInterval(intervalId);
          setFileTaskId(null);
          console.error(fileTask.errorMessage);
        }
      } catch (err) {
        notifications.update({
          id: "import",
          color: "red",
          title: t("Import failed"),
          message: t(
            "Something went wrong while importing pages: {{reason}}.",
            {
              reason: err.response?.data.message,
            },
          ),
          icon: <IconX size={18} />,
          loading: false,
          withCloseButton: true,
          autoClose: false,
        });
        clearInterval(intervalId);
        setFileTaskId(null);
        console.error("Failed to fetch import status", err);
      }
    }, 3000);
  }, [fileTaskId]);

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

  // @ts-ignore
  return (
    <>
      <SimpleGrid cols={2}>
        <FileButton onChange={handleFileUpload} accept=".md" multiple>
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

        <FileButton
          onChange={(file) => handleZipUpload(file, "notion")}
          accept="application/zip"
        >
          {(props) => (
            <Button
              justify="start"
              variant="default"
              leftSection={<IconBrandNotion size={18} />}
              {...props}
            >
              Notion
            </Button>
          )}
        </FileButton>
        <FileButton
          onChange={(file) => handleZipUpload(file, "confluence")}
          accept="application/zip"
        >
          {(props) => (
            <Tooltip
              label="Available in enterprise edition"
              disabled={canUseConfluence}
            >
              <Button
                disabled={!canUseConfluence}
                justify="start"
                variant="default"
                leftSection={<ConfluenceIcon size={18} />}
                {...props}
              >
                Confluence
              </Button>
            </Tooltip>
          )}
        </FileButton>
      </SimpleGrid>

      <Group justify="center" gap="xl" mih={150}>
        <div>
          <Text ta="center" size="lg" inline>
            Import zip file
          </Text>
          <Text ta="center" size="sm" c="dimmed" inline py="sm">
            {t(
              `Upload zip file containing Markdown and HTML files. Max: {{sizeLimit}}`,
              {
                sizeLimit: formatBytes(getFileImportSizeLimit()),
              },
            )}
          </Text>
          <FileButton
            onChange={(file) => handleZipUpload(file, "generic")}
            accept="application/zip"
          >
            {(props) => (
              <Group justify="center">
                <Button
                  justify="center"
                  leftSection={<IconFileTypeZip size={18} />}
                  {...props}
                >
                  {t("Upload file")}
                </Button>
              </Group>
            )}
          </FileButton>
        </div>
      </Group>
    </>
  );
}
