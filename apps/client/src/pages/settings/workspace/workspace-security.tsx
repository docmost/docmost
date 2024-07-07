import SettingsTitle from "../../../components/settings/settings-title"
import WorkspaceSecurityForm from "@/features/workspace/components/settings/components/workspace-security-form"

export default function WorkspaceSecuritySettings() {
  return (
    <>
      <SettingsTitle title="Security" />
      <WorkspaceSecurityForm />
    </>
  );
}
