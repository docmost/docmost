import { Modal, Text, ScrollArea } from "@mantine/core";
import { useTranslation } from "react-i18next";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";

interface Props {
  opened: boolean;
  onClose: () => void;
  pageTitle: string;
  pageContent: any;
}

export default function TrashPageContentModal({
  opened,
  onClose,
  pageTitle,
  pageContent,
}: Props) {
  const { t } = useTranslation();
  const title = pageTitle || t("Untitled");

  return (
    <Modal.Root size={1200} opened={opened} onClose={onClose}>
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header>
          <Modal.Title>
            <Text size="md" fw={500}>
              {t("Preview")}
            </Text>
          </Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body p={0}>
          <ScrollArea h="650" w="100%" scrollbarSize={5}>
            <ReadonlyPageEditor title={title} content={pageContent} />
          </ScrollArea>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
