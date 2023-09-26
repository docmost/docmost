'use client';

import { IconUserPlus } from '@tabler/icons-react';
import { WorkspaceInviteForm } from '@/features/settings/workspace/members/components/workspace-invite-form';
import { Button, Divider, Modal, ScrollArea, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

export default function WorkspaceInviteModal() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button onClick={open} leftSection={<IconUserPlus size={18} />}>
        Invite Members
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
