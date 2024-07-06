import { useState } from "react";
import { setupWorkspace } from "@/features/auth/services/auth-service";
import { useNavigate } from "react-router-dom";
import { ILogin, ISetupWorkspace } from "@/features/auth/types/auth.types";
import { notifications } from "@mantine/notifications";
import { IAcceptInvite } from "@/features/workspace/types/workspace.types.ts";
import { acceptInvitation } from "@/features/workspace/services/workspace-service.ts";
import APP_ROUTE from "@/lib/app-route.ts";
import api from "@/lib/api-client";

export default function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async (data: ILogin) => {
    setIsLoading(true);

    try {
      await api.post("/auth/login", data);

      setIsLoading(false);
      navigate(APP_ROUTE.HOME);
    } catch (err) {
      setIsLoading(false);

      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };

  const handleInvitationSignUp = async (data: IAcceptInvite) => {
    setIsLoading(true);

    try {
      await acceptInvitation(data);

      setIsLoading(false);
      navigate(APP_ROUTE.HOME);
    } catch (err) {
      setIsLoading(false);

      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };

  const handleSetupWorkspace = async (data: ISetupWorkspace) => {
    setIsLoading(true);

    try {
      await setupWorkspace(data);

      setIsLoading(false);
      navigate(APP_ROUTE.HOME);
    } catch (err) {
      setIsLoading(false);

      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };

  const handleIsAuthenticated = async () => {
    try {
      await api.get(`/users/me`);
      return true;
    } catch {
      return false;
    }
  };

  const handleLogout = async () => {
    await api.post(`/auth/logout`);
    navigate(APP_ROUTE.AUTH.LOGIN);
  };

  return {
    signIn: handleSignIn,
    invitationSignup: handleInvitationSignUp,
    setupWorkspace: handleSetupWorkspace,
    isAuthenticated: handleIsAuthenticated,
    logout: handleLogout,
    isLoading,
  };
}
