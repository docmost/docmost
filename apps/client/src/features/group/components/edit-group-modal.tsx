import { Divider, Modal } from "@mantine/core";
import { EditGroupForm } from "@/features/group/components/edit-group-form.tsx";

interface EditGroupModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function EditGroupModal({
  opened,
  onClose,
}: EditGroupModalProps) {
  return (
    <>
      <Modal opened={opened} onClose={onClose} title="Edit group">
        <Divider size="xs" mb="xs" />
        <EditGroupForm onClose={onClose} />
      </Modal>
    </>
  );
}
