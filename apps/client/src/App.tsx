import { Route, Routes } from "react-router-dom";
import { Welcome } from "@/pages/welcome";
import SignUpPage from "@/pages/auth/signup";
import LoginPage from "@/pages/auth/login";
import DashboardLayout from "@/components/layouts/dashboard/dashboard-layout.tsx";
import Home from "@/pages/dashboard/home";
import Page from "@/pages/page/page";
import AccountSettings from "@/pages/settings/account/account-settings";
import WorkspaceMembers from "@/pages/settings/workspace/workspace-members";
import SettingsLayout from "@/components/layouts/settings/settings-layout.tsx";
import WorkspaceSettings from "@/pages/settings/workspace/workspace-settings";
import Groups from "@/pages/settings/group/groups";
import GroupInfo from "./pages/settings/group/group-info";

export default function App() {
  return (
    <>
      <Routes>
        <Route index element={<Welcome />} />
        <Route path={"/login"} element={<LoginPage />} />
        <Route path={"/signup"} element={<SignUpPage />} />

        <Route element={<DashboardLayout />}>
          <Route path={"/home"} element={<Home />} />
          <Route path={"/p/:pageId"} element={<Page />} />
        </Route>

        <Route path={"/settings"} element={<SettingsLayout />}>
          <Route path={"profile"} element={<AccountSettings />} />
          <Route path={"workspace"} element={<WorkspaceSettings />} />
          <Route path={"members"} element={<WorkspaceMembers />} />
          <Route path={"groups"} element={<Groups />} />
          <Route path={"groups/:groupId"} element={<GroupInfo />} />
          <Route path={"spaces"} element={<Home />} />
          <Route path={"security"} element={<Home />} />
        </Route>
      </Routes>
    </>
  );
}
