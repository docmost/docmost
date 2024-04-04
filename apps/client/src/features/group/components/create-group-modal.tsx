import { Button, Divider, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { CreateGroupForm } from "@/features/group/components/create-group-form.tsx";

export default function CreateGroupModal() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button onClick={open}>Create group</Button>

      <Modal opened={opened} onClose={close} title="Create group">
        <Divider size="xs" mb="xs" />
        <CreateGroupForm />
      </Modal>
    </>
  );
}
