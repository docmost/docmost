import SettingsTitle from "@/components/settings/settings-title.tsx";
import SpaceList from "@/features/space/components/space-list.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";
import { Group } from "@mantine/core";
import CreateSpaceModal from "@/features/space/components/create-space-modal.tsx";

export default function Spaces() {
  const { isAdmin } = useUserRole();

  return (
    <>
      <SettingsTitle title="Spaces" />

      <Group my="md" justify="flex-end">
        {isAdmin && <CreateSpaceModal />}
      </Group>

      <SpaceList />
    </>
  );
}
