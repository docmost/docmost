import SettingsTitle from "@/components/settings/settings-title.tsx";
import WorkspaceNameForm from "@/features/workspace/components/settings/components/workspace-name-form";
import { useTranslation } from "react-i18next";

export default function WorkspaceSettings() {
  const { t } = useTranslation("workspace");

  return (
    <>
      <SettingsTitle title={t("General")} />
      <WorkspaceNameForm />
    </>
  );
}
