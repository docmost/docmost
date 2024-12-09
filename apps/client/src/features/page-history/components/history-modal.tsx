import { Modal, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms";
import HistoryModalBody from "@/features/page-history/components/history-modal-body";
import { useTranslation } from "react-i18next";

interface Props {
  pageId: string;
}
export default function HistoryModal({ pageId }: Props) {
  const { t } = useTranslation();
  const [isModalOpen, setModalOpen] = useAtom(historyAtoms);

  return (
    <>
      <Modal.Root
        size={1200}
        opened={isModalOpen}
        onClose={() => setModalOpen(false)}
      >
        <Modal.Overlay />
        <Modal.Content style={{ overflow: "hidden" }}>
          <Modal.Header>
            <Modal.Title>
              <Text size="md" fw={500}>
                {t("Page history")}
              </Text>
            </Modal.Title>
            <Modal.CloseButton />
          </Modal.Header>
          <Modal.Body>
            <HistoryModalBody pageId={pageId} />
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}
