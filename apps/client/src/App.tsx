import { Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/layouts/global/layout.tsx";
import { Error404 } from "@/components/ui/error-404.tsx";
import { isCloud } from "@/lib/config.ts";
import { lazyWithPrefetch, prefetchLazyComponents } from "@/lib/lazy-prefetch.ts";
import { useTranslation } from "react-i18next";
import { useRedirectToCloudSelect } from "@/ee/hooks/use-redirect-to-cloud-select.tsx";
import { useTrackOrigin } from "@/hooks/use-track-origin";


const SetupWorkspace = lazyWithPrefetch(() => import("@/pages/auth/setup-workspace.tsx"));
const LoginPage = lazyWithPrefetch(() => import("@/pages/auth/login"));
const Home = lazyWithPrefetch(() => import("@/pages/dashboard/home"));
const Page = lazyWithPrefetch(() => import("@/pages/page/page"), {
  prefetchFirst: true,
});
const AccountSettings = lazyWithPrefetch(
  () => import("@/pages/settings/account/account-settings"),
);
const WorkspaceMembers = lazyWithPrefetch(
  () => import("@/pages/settings/workspace/workspace-members"),
);
const WorkspaceSettings = lazyWithPrefetch(
  () => import("@/pages/settings/workspace/workspace-settings"),
);
const Groups = lazyWithPrefetch(() => import("@/pages/settings/group/groups"));
const GroupInfo = lazyWithPrefetch(() => import("./pages/settings/group/group-info"));
const Spaces = lazyWithPrefetch(() => import("@/pages/settings/space/spaces.tsx"));
const AccountPreferences = lazyWithPrefetch(
  () => import("@/pages/settings/account/account-preferences.tsx"),
);
const SpaceHome = lazyWithPrefetch(() => import("@/pages/space/space-home.tsx"));
const PageRedirect = lazyWithPrefetch(() => import("@/pages/page/page-redirect.tsx"));
const InviteSignup = lazyWithPrefetch(() => import("@/pages/auth/invite-signup.tsx"));
const ForgotPassword = lazyWithPrefetch(() => import("@/pages/auth/forgot-password.tsx"));
const PasswordReset = lazyWithPrefetch(() => import("./pages/auth/password-reset"));
const Billing = lazyWithPrefetch(() => import("@/ee/billing/pages/billing.tsx"));
const CloudLogin = lazyWithPrefetch(() => import("@/ee/pages/cloud-login.tsx"));
const CreateWorkspace = lazyWithPrefetch(() => import("@/ee/pages/create-workspace.tsx"));
const Security = lazyWithPrefetch(() => import("@/ee/security/pages/security.tsx"));
const License = lazyWithPrefetch(() => import("@/ee/licence/pages/license.tsx"));
const SharedPage = lazyWithPrefetch(() => import("@/pages/share/shared-page.tsx"));
const PdfRenderPage = lazyWithPrefetch(() => import("@/ee/pdf-export/pdf-render-page.tsx"));
const Shares = lazyWithPrefetch(() => import("@/pages/settings/shares/shares.tsx"));
const ShareLayout = lazyWithPrefetch(
  () => import("@/features/share/components/share-layout.tsx"),
);
const ShareRedirect = lazyWithPrefetch(() => import("@/pages/share/share-redirect.tsx"));
const PublicSpacePage = lazyWithPrefetch(
  () => import("@/pages/public-space/public-space-page.tsx"),
);
const PublicSpaceLayout = lazyWithPrefetch(
  () => import("@/features/public-space/components/public-space-layout.tsx"),
);
const PublicSpaceDirectoryPage = lazyWithPrefetch(
  () => import("@/pages/public-space/public-space-directory-page.tsx"),
);
const SpacesPage = lazyWithPrefetch(() => import("@/pages/spaces/spaces.tsx"));
const MfaChallengePage = lazyWithPrefetch(() =>
  import("@/ee/mfa/pages/mfa-challenge-page").then((m) => ({
    default: m.MfaChallengePage,
  })),
);
const MfaSetupRequiredPage = lazyWithPrefetch(() =>
  import("@/ee/mfa/pages/mfa-setup-required-page").then((m) => ({
    default: m.MfaSetupRequiredPage,
  })),
);
const SpaceTrash = lazyWithPrefetch(() => import("@/pages/space/space-trash.tsx"));
const UserApiKeys = lazyWithPrefetch(() => import("@/ee/api-key/pages/user-api-keys"));
const WorkspaceApiKeys = lazyWithPrefetch(
  () => import("@/ee/api-key/pages/workspace-api-keys"),
);
const AiSettings = lazyWithPrefetch(() => import("@/ee/ai/pages/ai-settings.tsx"));
const BasePage = lazyWithPrefetch(() => import("@/ee/base/pages/base-page.tsx"));
const AuditLogs = lazyWithPrefetch(() => import("@/ee/audit/pages/audit-logs.tsx"));
const VerifiedPages = lazyWithPrefetch(
  () => import("@/ee/page-verification/pages/verified-pages.tsx"),
);
const TemplateList = lazyWithPrefetch(() => import("@/ee/template/pages/template-list"));
const TemplateEditor = lazyWithPrefetch(
  () => import("@/ee/template/pages/template-editor"),
);
const FavoritesPage = lazyWithPrefetch(() => import("@/pages/favorites/favorites-page"));
const AiChat = lazyWithPrefetch(() => import("@/ee/ai-chat/pages/ai-chat.tsx"));
const VerifyEmail = lazyWithPrefetch(() => import("@/ee/pages/verify-email.tsx"));
const LabelPage = lazyWithPrefetch(() => import("@/pages/label/label-page"));
const OAuthConsent = lazyWithPrefetch(() => import("@/ee/oauth/pages/oauth-consent.tsx"));
const Integrations = lazyWithPrefetch(
  () => import("@/features/integration/pages/integrations.tsx"),
);
const Connections = lazyWithPrefetch(
  () => import("@/features/integration/pages/connections.tsx"),
);

export default function App() {
  const { t } = useTranslation();
  useRedirectToCloudSelect();
  useTrackOrigin();

  useEffect(() => {
    // the dev server would transform every route module on each reload
    if (import.meta.env.DEV) {
      return;
    }
    const timer = setTimeout(prefetchLazyComponents, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route index element={<Navigate to="/home" />} />
        <Route path={"/login"} element={<LoginPage />} />
        <Route path={"/invites/:invitationId"} element={<InviteSignup />} />
        <Route path={"/forgot-password"} element={<ForgotPassword />} />
        <Route path={"/password-reset"} element={<PasswordReset />} />
        <Route path={"/login/mfa"} element={<MfaChallengePage />} />
        <Route path={"/login/mfa/setup"} element={<MfaSetupRequiredPage />} />
        <Route path={"/oauth/consent"} element={<OAuthConsent />} />

        {!isCloud() && (
          <Route path={"/setup/register"} element={<SetupWorkspace />} />
        )}

        {isCloud() && (
          <>
            <Route path={"/create"} element={<CreateWorkspace />} />
            <Route path={"/select"} element={<CloudLogin />} />
            <Route path={"/verify-email"} element={<VerifyEmail />} />
          </>
        )}

        <Route element={<ShareLayout />}>
          <Route
            path={"/share/:shareId/p/:pageSlug"}
            element={<SharedPage />}
          />
          <Route path={"/share/p/:pageSlug"} element={<SharedPage />} />
        </Route>

        <Route path={"/docs"} element={<PublicSpaceDirectoryPage />} />
        <Route element={<PublicSpaceLayout />}>
          <Route path={"/docs/:spaceSlug"} element={<PublicSpacePage />} />
          <Route
            path={"/docs/:spaceSlug/:pageSlug"}
            element={<PublicSpacePage />}
          />
        </Route>

        <Route path={"/pdf-render/:pageId"} element={<PdfRenderPage />} />
        <Route path={"/share/:shareId"} element={<ShareRedirect />} />
        <Route path={"/p/:pageSlug"} element={<PageRedirect />} />
        <Route
          path={"/integrations/slack/link"}
          element={
            <Navigate to="/settings/account/connections?connect=slack" replace />
          }
        />

        <Route element={<Layout />}>
          <Route path={"/home"} element={<Home />} />
          <Route path={"/ai"} element={<AiChat />} />
          <Route path={"/ai/chat/:chatId"} element={<AiChat />} />
          <Route path={"/spaces"} element={<SpacesPage />} />
          <Route path={"/favorites"} element={<FavoritesPage />} />
          <Route path={"/labels/:labelName"} element={<LabelPage />} />
          <Route path={"/templates"} element={<TemplateList />} />
          <Route
            path={"/templates/:templateId"}
            element={<TemplateEditor />}
          />
          <Route path={"/s/:spaceSlug"} element={<SpaceHome />} />
          <Route path={"/s/:spaceSlug/trash"} element={<SpaceTrash />} />
          <Route
            path={"/s/:spaceSlug/p/:pageSlug"}
            element={<Page />}
          />

          <Route path={"/base/:pageId"} element={<BasePage />} />

          <Route path={"/settings"}>
            <Route path={"account/profile"} element={<AccountSettings />} />
            <Route
              path={"account/preferences"}
              element={<AccountPreferences />}
            />
            <Route path={"account/api-keys"} element={<UserApiKeys />} />
            <Route
              path={"account/api-keys/authorized-apps"}
              element={<UserApiKeys />}
            />
            <Route path={"account/connections"} element={<Connections />} />
            <Route path={"workspace"} element={<WorkspaceSettings />} />
            <Route path={"members"} element={<WorkspaceMembers />} />
            <Route path={"api-keys"} element={<WorkspaceApiKeys />} />
            <Route path={"groups"} element={<Groups />} />
            <Route path={"groups/:groupId"} element={<GroupInfo />} />
            <Route path={"spaces"} element={<Spaces />} />
            <Route path={"sharing"} element={<Shares />} />
            <Route path={"security"} element={<Security />} />
            <Route path={"ai"} element={<AiSettings />} />
            <Route path={"ai/mcp"} element={<AiSettings />} />
            <Route path={"audit"} element={<AuditLogs />} />
            <Route path={"audit/siem"} element={<AuditLogs />} />
            <Route
              path={"siem"}
              element={<Navigate to="/settings/audit/siem" replace />}
            />
            <Route path={"verifications"} element={<VerifiedPages />} />
            <Route path={"integrations"} element={<Integrations />} />
            {!isCloud() && <Route path={"license"} element={<License />} />}
            {isCloud() && <Route path={"billing"} element={<Billing />} />}
          </Route>
        </Route>

        <Route path="*" element={<Error404 />} />
      </Routes>
    </Suspense>
  );
}
