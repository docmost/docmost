import SettingsTitle from "@/components/settings/settings-title.tsx";
import SpaceList from "@/features/space/components/space-list.tsx";

export default function Spaces() {
  return (
    <>
      <SettingsTitle title="Spaces" />
      <SpaceList />
    </>
  );
}
