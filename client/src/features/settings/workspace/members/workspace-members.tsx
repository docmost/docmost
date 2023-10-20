import WorkspaceInviteSection from '@/features/settings/workspace/members/components/workspace-invite-section';
import React from 'react';
import WorkspaceInviteModal from '@/features/settings/workspace/members/components/workspace-invite-modal';
import { Divider, Group, Space, Text } from '@mantine/core';

const WorkspaceMembersTable = React.lazy(() => import('@/features/settings/workspace/members/components/workspace-members-table'));

export default function WorkspaceMembers() {
  return (
    <>
      <WorkspaceInviteSection />

      <Divider my="lg" />

      <Group justify="space-between">
        <Text fw={500}>Members</Text>

        <WorkspaceInviteModal />

      </Group>

      <Space h="lg" />

      <WorkspaceMembersTable />

    </>
  );
}
