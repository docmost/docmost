import SettingsTitle from "@/components/settings/settings-title.tsx";
import GroupMembersList from "@/features/group/components/group-members";
import GroupDetails from "@/features/group/components/group-details";
import { useTranslation } from "react-i18next";

export default function GroupInfo() {
  const { t } = useTranslation("settings", {
    keyPrefix: "workspace.group",
  });

  return (
    <>
      <SettingsTitle title={t("Manage Group")} />
      <GroupDetails />
      <GroupMembersList />
    </>
  );
}
