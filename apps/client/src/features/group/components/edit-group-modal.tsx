import { Divider, Modal } from "@mantine/core";
import { EditGroupForm } from "@/features/group/components/edit-group-form.tsx";
import { useTranslation } from "react-i18next";

interface EditGroupModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function EditGroupModal({
  opened,
  onClose,
}: EditGroupModalProps) {
  const { t } = useTranslation();

  return (
    <>
      <Modal opened={opened} onClose={onClose} title={t("Edit group")}>
        <Divider size="xs" mb="xs" />
        <EditGroupForm onClose={onClose} />
      </Modal>
    </>
  );
}
