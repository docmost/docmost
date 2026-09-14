import SettingsTitle from "@/components/settings/settings-title.tsx";
import AccountLanguage from "@/features/user/components/account-language.tsx";
import AccountTheme from "@/features/user/components/account-theme.tsx";
import PageWidthPref from "@/features/user/components/page-width-pref.tsx";
import PageEditPref from "@/features/user/components/page-state-pref";
import FixedToolbarPref from "@/features/user/components/fixed-toolbar-pref";
import NotificationPref from "@/features/user/components/notification-pref";
import { Divider } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { DocumentTitle } from "@/components/ui/document-title.tsx";

export default function AccountPreferences() {
  const { t } = useTranslation();

  return (
    <>
      <DocumentTitle title={t("Preferences")} />
      <SettingsTitle title={t("Preferences")} />

      <AccountTheme />

      <Divider my={"md"} />

      <AccountLanguage />

      <Divider my={"md"} />

      <PageWidthPref />
      
      <Divider my={"md"} />

      <PageEditPref />

      <Divider my={"md"} />

      <FixedToolbarPref />

      <Divider my={"md"} />

      <NotificationPref />
    </>
  );
}
