import SettingsTitle from "@/components/settings/settings-title.tsx";
import AdminIntegrationConnections from "@/features/integrations/components/admin-integration-connections";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

export default function WorkspaceIntegrations() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>Workspace Integrations - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title={t("Workspace integrations")} />
      <AdminIntegrationConnections />
    </>
  );
}
