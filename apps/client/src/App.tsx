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
import Spaces from "@/pages/settings/space/spaces.tsx";
import { Error404 } from "@/components/ui/error-404.tsx";
import { useQuerySubscription } from "@/features/websocket/use-query-subscription.ts";
import { useAtom, useAtomValue } from "jotai";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useTreeSocket } from "@/features/websocket/use-tree-socket.ts";
import { useEffect } from "react";
import { io } from "socket.io-client";
import { authTokensAtom } from "@/features/auth/atoms/auth-tokens-atom.ts";
import { SOCKET_URL } from "@/features/websocket/types";
import AccountPreferences from "@/pages/settings/account/account-preferences.tsx";

export default function App() {
  const [, setSocket] = useAtom(socketAtom);
  const authToken = useAtomValue(authTokensAtom);

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
        <Route index element={<Welcome />} />
        <Route path={"/login"} element={<LoginPage />} />
        <Route path={"/signup"} element={<SignUpPage />} />

        <Route element={<DashboardLayout />}>
          <Route path={"/home"} element={<Home />} />
          <Route path={"/p/:pageId"} element={<Page />} />
        </Route>

        <Route path={"/settings"} element={<SettingsLayout />}>
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
        <Route path="*" element={<Error404 />} />
      </Routes>
    </>
  );
}
