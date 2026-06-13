import SettingsTitle from "@/components/settings/settings-title.tsx";
import LinearConnection from "@/features/linear/components/linear-connection.tsx";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

export default function Integrations() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Integrations")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Integrations")} />

      <LinearConnection />
    </>
  );
}
