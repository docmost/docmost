import { Modal, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms";
import HistoryModalBody from "@/features/page-history/components/history-modal-body";
import HistoryModalMobile from "@/features/page-history/components/history-modal-mobile";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@mantine/hooks";

interface Props {
  pageId: string;
  pageTitle?: string;
}

export default function HistoryModal({ pageId, pageTitle }: Props) {
  const { t } = useTranslation();
  const [isModalOpen, setModalOpen] = useAtom(historyAtoms);
  const isMobile = useMediaQuery("(max-width: 800px)");

  if (isMobile) {
    return (
      <Modal.Root
        opened={isModalOpen}
        onClose={() => setModalOpen(false)}
        fullScreen
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
          <Modal.Body
            p={0}
            style={{ height: "calc(100vh - 60px)", overflow: "hidden" }}
          >
            <HistoryModalMobile pageId={pageId} pageTitle={pageTitle} />
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    );
  }

  return (
    <Modal.Root
      size={1400}
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
  );
}
