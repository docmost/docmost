import { Navigate, Route, Routes } from "react-router-dom";
import SetupWorkspace from "@/pages/auth/setup-workspace.tsx";
import LoginPage from "@/pages/auth/login";
import Home from "@/pages/dashboard/home";
import Page from "@/pages/page/page";
import AccountSettings from "@/pages/settings/account/account-settings";
import WorkspaceMembers from "@/pages/settings/workspace/workspace-members";
import WorkspaceSettings from "@/pages/settings/workspace/workspace-settings";
import Groups from "@/pages/settings/group/groups";
import GroupInfo from "./pages/settings/group/group-info";
import Spaces from "@/pages/settings/space/spaces.tsx";
import { Error404 } from "@/components/ui/error-404.tsx";
import AccountPreferences from "@/pages/settings/account/account-preferences.tsx";
import SpaceHome from "@/pages/space/space-home.tsx";
import PageRedirect from "@/pages/page/page-redirect.tsx";
import Layout from "@/components/layouts/global/layout.tsx";
import { ErrorBoundary } from "react-error-boundary";
import InviteSignup from "@/pages/auth/invite-signup.tsx";
import ForgotPassword from "@/pages/auth/forgot-password.tsx";
import PasswordReset from "./pages/auth/password-reset";
import OidcCallbackPage from "@/pages/auth/oidc-callback.tsx";
import { isCloud } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";
import SharedPage from "@/pages/share/shared-page.tsx";
import Shares from "@/pages/settings/shares/shares.tsx";
import ShareLayout from "@/features/share/components/share-layout.tsx";
import ShareRedirect from '@/pages/share/share-redirect.tsx';
import { useTrackOrigin } from "@/hooks/use-track-origin";
import SpaceGraph from "./pages/space/space-graph";
import OidcSettingsPage from "@/pages/settings/oidc.tsx";

export default function App() {
  const { t } = useTranslation();
  useTrackOrigin();

  return (
    <>
      <Routes>
        <Route index element={<Navigate to="/home" />} />
        <Route path={"/login"} element={<LoginPage />} />
        <Route path={"/invites/:invitationId"} element={<InviteSignup />} />
        <Route path={"/forgot-password"} element={<ForgotPassword />} />
        <Route path={"/password-reset"} element={<PasswordReset />} />
        <Route path={"/auth/oidc/callback"} element={<OidcCallbackPage />} />

        {!isCloud() && (
          <Route path={"/setup/register"} element={<SetupWorkspace />} />
        )}

        <Route element={<ShareLayout />}>
          <Route path={"/share/:shareId/p/:pageSlug"} element={<SharedPage />} />
          <Route path={"/share/p/:pageSlug"} element={<SharedPage />} />
        </Route>

        <Route path={"/share/:shareId"} element={<ShareRedirect />} />
        <Route path={"/p/:pageSlug"} element={<PageRedirect />} />

        <Route element={<Layout />}>
          <Route path={"/home"} element={<Home />} />
          <Route path={"/s/:spaceSlug"} element={<SpaceHome />} />
          <Route path={"/s/:spaceSlug/graph"} element={<SpaceGraph />} />
          <Route
            path={"/s/:spaceSlug/p/:pageSlug"}
            element={
              <ErrorBoundary
                fallback={<>{t("Failed to load page. An error occurred.")}</>}
              >
                <Page />
              </ErrorBoundary>
            }
          />

          <Route path={"/settings"}>
            <Route path={"account/profile"} element={<AccountSettings />} />
            <Route
              path={"account/preferences"}
              element={<AccountPreferences />}
            />
            <Route path={"workspace"} element={<WorkspaceSettings />} />
            <Route path={"members"} element={<WorkspaceMembers />} />
            <Route path={"groups"} element={<Groups />} />
            <Route path={"groups/:groupId"} element={<GroupInfo />} />
            <Route path={"spaces"} element={<Spaces />} />
            <Route path={"sharing"} element={<Shares />} />
            <Route path={"oidc"} element={<OidcSettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Error404 />} />
      </Routes>
    </>
  );
}
