import { UserProvider } from "@/features/user/user-provider.tsx";
import Shell from "./shell.tsx";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <UserProvider>
      <Shell>
        <Outlet />
      </Shell>
    </UserProvider>
  );
}
