import GroupList from "@/features/group/components/group-list";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { Group, Text } from "@mantine/core";
import CreateGroupModal from "@/features/group/components/create-group-modal";

export default function Groups() {
  return (
    <>
      <SettingsTitle title="Groups" />

      <Group my="md" justify="flex-end">
        <CreateGroupModal />
      </Group>

      <GroupList />
    </>
  );
}
