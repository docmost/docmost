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
import { useQuerySubscription } from "@/features/websocket/use-query-subscription.ts";
import { useAtom, useAtomValue } from "jotai";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useTreeSocket } from "@/features/websocket/use-tree-socket.ts";
import { useEffect, useTransition } from "react";
import { io } from "socket.io-client";
import { authTokensAtom } from "@/features/auth/atoms/auth-tokens-atom.ts";
import { SOCKET_URL } from "@/features/websocket/types";
import AccountPreferences from "@/pages/settings/account/account-preferences.tsx";
import SpaceHome from "@/pages/space/space-home.tsx";
import PageRedirect from "@/pages/page/page-redirect.tsx";
import Layout from "@/components/layouts/global/layout.tsx";
import { ErrorBoundary } from "react-error-boundary";
import InviteSignup from "@/pages/auth/invite-signup.tsx";
import ForgotPassword from "@/pages/auth/forgot-password.tsx";
import PasswordReset from "./pages/auth/password-reset";
import { useTranslation } from "react-i18next";

export default function App() {
  const [, setSocket] = useAtom(socketAtom);
  const authToken = useAtomValue(authTokensAtom);
  const { t } = useTranslation();

  useEffect(() => {
    if (!authToken?.accessToken) {
      return;
    }
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: {
        token: authToken.accessToken,
      },
    });

    // @ts-ignore
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("ws connected");
    });

    return () => {
      console.log("ws disconnected");
      newSocket.disconnect();
    };
  }, [authToken?.accessToken]);

  useQuerySubscription();
  useTreeSocket();

  return (
    <>
      <Routes>
        <Route index element={<Navigate to="/home" />} />
        <Route path={"/login"} element={<LoginPage />} />
        <Route path={"/invites/:invitationId"} element={<InviteSignup />} />
        <Route path={"/setup/register"} element={<SetupWorkspace />} />
        <Route path={"/forgot-password"} element={<ForgotPassword />} />
        <Route path={"/password-reset"} element={<PasswordReset />} />

        <Route path={"/p/:pageSlug"} element={<PageRedirect />} />

        <Route element={<Layout />}>
          <Route path={"/home"} element={<Home />} />

          <Route path={"/s/:spaceSlug"} element={<SpaceHome />} />
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
          </Route>
        </Route>

        <Route path="*" element={<Error404 />} />
      </Routes>
    </>
  );
}
