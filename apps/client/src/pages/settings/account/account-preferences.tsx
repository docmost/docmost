import SettingsTitle from "@/components/settings/settings-title.tsx";
import AccountLanguage from "@/features/user/components/account-languate";
import AccountTheme from "@/features/user/components/account-theme.tsx";
import PageWidthPref from "@/features/user/components/page-width-pref.tsx";
import { Divider } from "@mantine/core";
import { useTranslation } from "react-i18next";

export default function AccountPreferences() {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle title={t("Preferences")} />
      <AccountTheme />
      <Divider my={"md"} />
      <AccountLanguage />
      <Divider my={"md"} />
      <PageWidthPref />
    </>
  );
}
