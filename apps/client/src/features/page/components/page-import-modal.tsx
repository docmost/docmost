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
  return (
    <>
      <Modal
        opened={open}
        onClose={onClose}
        size="500"
        title="Import page"
        centered
      >
        <ImportFormatSelection spaceId={spaceId} onClose={onClose} />
      </Modal>
    </>
  );
}

interface ImportFormatSelection {
  spaceId: string;
  onClose: () => void;
}
function ImportFormatSelection({ spaceId, onClose }: ImportFormatSelection) {
  const [treeData, setTreeData] = useAtom(treeDataAtom);

  const handleFileUpload = async (selectedFiles: File[]) => {
    if (!selectedFiles) {
      return;
    }

    onClose();

    const alert = notifications.show({
      title: "Importing pages",
      message: "Page import is in progress. Please do not close this tab.",
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

    const treeBranch = buildTree(pages);
    const newTree = treeData.concat(treeBranch);

    if (newTree && newTree.length > 0) {
      setTreeData(newTree);
    }

    if (pageCount > 0) {
      notifications.update({
        id: alert,
        color: "teal",
        title: `Successfully imported ${pageCount} pages`,
        message: "Your import is complete.",
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 3000,
      });
    } else {
      notifications.update({
        id: alert,
        color: "red",
        title: `Failed to import pages`,
        message: "Unable to import pages. Please try again.",
        icon: <IconX size={18} />,
        loading: false,
        autoClose: 3000,
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
