import SettingsTitle from "@/components/settings/settings-title.tsx";
import AccountTheme from "@/features/user/components/account-theme.tsx";
import PageWidthPref from "@/features/user/components/page-width-pref.tsx";
import { Divider } from "@mantine/core";

export default function AccountPreferences() {
  return (
    <>
      <SettingsTitle title="Preferences" />
      <AccountTheme />
      <Divider my={"md"} />
      <PageWidthPref />
    </>
  );
}
