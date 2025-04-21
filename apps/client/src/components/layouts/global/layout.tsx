import { UserProvider } from "@/features/user/user-provider.tsx";
import { Outlet } from "react-router-dom";
import GlobalAppShell from "@/components/layouts/global/global-app-shell.tsx";

export default function Layout() {
  return (
    <UserProvider>
      <GlobalAppShell>
        <Outlet />
      </GlobalAppShell>
    </UserProvider>
  );
}
