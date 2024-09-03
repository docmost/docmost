import GroupList from "@/features/group/components/group-list";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { Group } from "@mantine/core";
import CreateGroupModal from "@/features/group/components/create-group-modal";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useTranslation } from "react-i18next";

export default function Groups() {
  const { t } = useTranslation("group");
  const { isAdmin } = useUserRole();

  return (
    <>
      <SettingsTitle title={t("Groups")} />

      <Group my="md" justify="flex-end">
        {isAdmin && <CreateGroupModal />}
      </Group>

      <GroupList />
    </>
  );
}
