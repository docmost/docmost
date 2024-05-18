import { UserProvider } from "@/features/user/user-provider.tsx";
import Shell from "./shell.tsx";
import { Outlet } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function DashboardLayout() {
  return (
    <UserProvider>
      <Shell>
        <Helmet>
          <title>Home</title>
        </Helmet>
        <Outlet />
      </Shell>
    </UserProvider>
  );
}
