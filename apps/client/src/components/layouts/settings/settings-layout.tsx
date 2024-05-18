import { UserProvider } from "@/features/user/user-provider.tsx";
import { Outlet } from "react-router-dom";
import SettingsShell from "@/components/layouts/settings/settings-shell.tsx";
import { Helmet } from "react-helmet-async";

export default function SettingsLayout() {
  return (
    <UserProvider>
      <SettingsShell>
        <Helmet>
          <title>Settings</title>
        </Helmet>
        <Outlet />
      </SettingsShell>
    </UserProvider>
  );
}
