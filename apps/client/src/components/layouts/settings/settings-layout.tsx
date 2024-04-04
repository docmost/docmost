import { UserProvider } from "@/features/user/user-provider.tsx";
import { Outlet } from "react-router-dom";
import SettingsShell from "@/components/layouts/settings/settings-shell.tsx";

export default function SettingsLayout() {
  return (
    <UserProvider>
      <SettingsShell>
        <Outlet />
      </SettingsShell>
    </UserProvider>
  );
}
