import { Divider, Modal } from "@mantine/core";
import { EditGroupForm } from "@/features/group/components/edit-group-form.tsx";
import { useTranslation } from "react-i18next";
import { IGroup } from "@/features/group/types/group.types.ts";

interface EditGroupModalProps {
  opened: boolean;
  onClose: () => void;
  group?: IGroup;
}

export default function EditGroupModal({
  opened,
  onClose,
  group,
}: EditGroupModalProps) {
  const { t } = useTranslation();

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={t("Edit group")}
        closeButtonProps={{ "aria-label": t("Close") }}
      >
        <Divider size="xs" mb="xs" />
        <EditGroupForm onClose={onClose} group={group} />
      </Modal>
    </>
  );
}
