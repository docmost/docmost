import WorkspaceInviteSection from "@/features/workspace/components/members/components/workspace-invite-section";
import WorkspaceInviteModal from "@/features/workspace/components/members/components/workspace-invite-modal";
import { Divider, Group, Space, Text } from "@mantine/core";
import WorkspaceMembersTable from "@/features/workspace/components/members/components/workspace-members-table";
import SettingsTitle from "@/components/layouts/settings/settings-title.tsx";

export default function WorkspaceMembers() {
  return (
    <>
      <SettingsTitle title="Members" />

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
