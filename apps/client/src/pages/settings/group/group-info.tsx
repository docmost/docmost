import SettingsTitle from "@/components/settings/settings-title.tsx";
import GroupMembersList from "@/features/group/components/group-members";
import GroupDetails from "@/features/group/components/group-details";

export default function GroupInfo() {
  return (
    <>
      <SettingsTitle title="Manage Group" />
      <GroupDetails />
      <GroupMembersList />
    </>
  );
}
