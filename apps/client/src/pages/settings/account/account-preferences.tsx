import SettingsTitle from "@/components/settings/settings-title.tsx";
import AccountTheme from "@/features/user/components/account-theme.tsx";

export default function AccountPreferences() {
  return (
    <>
      <SettingsTitle title="Preferences" />
      <AccountTheme />
    </>
  );
}
