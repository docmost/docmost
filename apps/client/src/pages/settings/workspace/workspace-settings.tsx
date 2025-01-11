import SettingsTitle from "@/components/settings/settings-title.tsx";
import WorkspaceNameForm from "@/features/workspace/components/settings/components/workspace-name-form";
import { useTranslation } from "react-i18next";
import {getAppName} from "@/lib/config.ts";
import {Helmet} from "react-helmet-async";

export default function WorkspaceSettings() {
  const { t } = useTranslation();
    return (
        <>
            <Helmet>
                <title>Workspace Settings - {getAppName()}</title>
            </Helmet>
            <SettingsTitle title={t("General")} />
            <WorkspaceNameForm/>
        </>
    );
}
