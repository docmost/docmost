import SettingsTitle from "@/components/settings/settings-title.tsx";
import AccountLanguage from "@/features/user/components/account-language.tsx";
import AccountTheme from "@/features/user/components/account-theme.tsx";
import PageWidthPref from "@/features/user/components/page-width-pref.tsx";
import PageEditPref from "@/features/user/components/page-state-pref";
import { getAppName } from "@/lib/config.ts";
import { Divider } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

export default function AccountPreferences() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Preferences")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Preferences")} />

      <AccountTheme />

      <Divider my={"md"} />

      <AccountLanguage />

      <Divider my={"md"} />

      <PageWidthPref />
      
      <Divider my={"md"} />

      <PageEditPref />
    </>
  );
}
