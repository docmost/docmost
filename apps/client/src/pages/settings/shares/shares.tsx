import SettingsTitle from "@/components/settings/settings-title.tsx";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";
import ShareList from "@/features/share/components/share-list.tsx";

export default function Shares() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Shares")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Shares")} />
      <ShareList />
    </>
  );
}
