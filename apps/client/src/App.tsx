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
import Billing from "@/ee/billing/pages/billing.tsx";
import CloudLogin from "@/ee/pages/cloud-login.tsx";
import CreateWorkspace from "@/ee/pages/create-workspace.tsx";
import { isCloud } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";
import Security from "@/ee/security/pages/security.tsx";
import License from "@/ee/licence/pages/license.tsx";
import { useRedirectToCloudSelect } from "@/ee/hooks/use-redirect-to-cloud-select.tsx";
import SharedPage from "@/pages/share/shared-page.tsx";
import Shares from "@/pages/settings/shares/shares.tsx";
import ShareLayout from "@/features/share/components/share-layout.tsx";
import ShareRedirect from "@/pages/share/share-redirect.tsx";
import { useTrackOrigin } from "@/hooks/use-track-origin";
import SpacesPage from "@/pages/spaces/spaces.tsx";
import { MfaChallengePage } from "@/ee/mfa/pages/mfa-challenge-page";
import { MfaSetupRequiredPage } from "@/ee/mfa/pages/mfa-setup-required-page";
import SpaceTrash from "@/pages/space/space-trash.tsx";
import UserApiKeys from "@/ee/api-key/pages/user-api-keys";
import WorkspaceApiKeys from "@/ee/api-key/pages/workspace-api-keys";
import AiSettings from "@/ee/ai/pages/ai-settings.tsx";

export default function App() {
  const { t } = useTranslation();
  useRedirectToCloudSelect();
  useTrackOrigin();

  return (
    <>
      <Routes>
        <Route index element={<Navigate to="/home" />} />
        <Route path={"/login"} element={<LoginPage />} />
        <Route path={"/invites/:invitationId"} element={<InviteSignup />} />
        <Route path={"/forgot-password"} element={<ForgotPassword />} />
        <Route path={"/password-reset"} element={<PasswordReset />} />
        <Route path={"/login/mfa"} element={<MfaChallengePage />} />
        <Route path={"/login/mfa/setup"} element={<MfaSetupRequiredPage />} />

        {!isCloud() && (
          <Route path={"/setup/register"} element={<SetupWorkspace />} />
        )}

        {isCloud() && (
          <>
            <Route path={"/create"} element={<CreateWorkspace />} />
            <Route path={"/select"} element={<CloudLogin />} />
          </>
        )}

        <Route element={<ShareLayout />}>
          <Route
            path={"/share/:shareId/p/:pageSlug"}
            element={<SharedPage />}
          />
          <Route path={"/share/p/:pageSlug"} element={<SharedPage />} />
        </Route>

        <Route path={"/share/:shareId"} element={<ShareRedirect />} />
        <Route path={"/p/:pageSlug"} element={<PageRedirect />} />

        <Route element={<Layout />}>
          <Route path={"/home"} element={<Home />} />
          <Route path={"/spaces"} element={<SpacesPage />} />
          <Route path={"/s/:spaceSlug"} element={<SpaceHome />} />
          <Route path={"/s/:spaceSlug/trash"} element={<SpaceTrash />} />
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
            <Route path={"account/api-keys"} element={<UserApiKeys />} />
            <Route path={"workspace"} element={<WorkspaceSettings />} />
            <Route path={"members"} element={<WorkspaceMembers />} />
            <Route path={"api-keys"} element={<WorkspaceApiKeys />} />
            <Route path={"groups"} element={<Groups />} />
            <Route path={"groups/:groupId"} element={<GroupInfo />} />
            <Route path={"spaces"} element={<Spaces />} />
            <Route path={"sharing"} element={<Shares />} />
            <Route path={"security"} element={<Security />} />
            <Route path={"ai"} element={<AiSettings />} />
            {!isCloud() && <Route path={"license"} element={<License />} />}
            {isCloud() && <Route path={"billing"} element={<Billing />} />}
          </Route>
        </Route>

        <Route path="*" element={<Error404 />} />
      </Routes>
    </>
  );
}
