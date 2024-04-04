import { WorkspaceInviteForm } from '@/features/settings/workspace/members/components/workspace-invite-form';
import { Button, Divider, Modal, ScrollArea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

export default function WorkspaceInviteModal() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button onClick={open}>
        Invite members
      </Button>

      <Modal size="600" opened={opened} onClose={close} title="Invite new members" centered>

        <Divider size="xs" mb="xs"/>

        <ScrollArea h="80%">

          <WorkspaceInviteForm />

        </ScrollArea>
      </Modal>

    </>
  );
}
