import { Modal } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { BulkUpload } from "@/features/organize/components/bulk-upload";

interface BulkUploadModalProps {
  spaceId: string;
  open: boolean;
  onClose: () => void;
}

export function BulkUploadModal({
  spaceId,
  open,
  onClose,
}: BulkUploadModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      opened={open}
      onClose={onClose}
      title={t("Bulk upload & organize")}
      size="lg"
    >
      <BulkUpload spaceId={spaceId} />
    </Modal>
  );
}
