import { useState } from "react";
import {
  forgotPassword,
  login,
  passwordReset,
  setupWorkspace,
  verifyUserToken,
} from "@/features/auth/services/auth-service";
import { useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { authTokensAtom } from "@/features/auth/atoms/auth-tokens-atom";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  IForgotPassword,
  ILogin,
  IPasswordReset,
  ISetupWorkspace,
  IVerifyUserToken,
} from "@/features/auth/types/auth.types";
import { notifications } from "@mantine/notifications";
import { IAcceptInvite } from "@/features/workspace/types/workspace.types.ts";
import { acceptInvitation } from "@/features/workspace/services/workspace-service.ts";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import APP_ROUTE from "@/lib/app-route.ts";
import { useQueryClient } from "@tanstack/react-query";

export default function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [authToken, setAuthToken] = useAtom(authTokensAtom);
  const queryClient = useQueryClient();

  const handleSignIn = async (data: ILogin) => {
    setIsLoading(true);

    try {
      const res = await login(data);
      setIsLoading(false);
      setAuthToken(res.tokens);

      navigate(APP_ROUTE.HOME);
    } catch (err) {
      console.log(err);
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
      const res = await acceptInvitation(data);
      setIsLoading(false);

      setAuthToken(res.tokens);

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
      const res = await setupWorkspace(data);
      setIsLoading(false);

      setAuthToken(res.tokens);

      navigate(APP_ROUTE.HOME);
    } catch (err) {
      setIsLoading(false);
      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };

  const handlePasswordReset = async (data: IPasswordReset) => {
    setIsLoading(true);

    try {
      const res = await passwordReset(data);
      setIsLoading(false);

      setAuthToken(res.tokens);

      navigate(APP_ROUTE.HOME);
      notifications.show({
        message: "Password reset was successful",
      });
    } catch (err) {
      setIsLoading(false);
      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };

  const handleIsAuthenticated = async () => {
    if (!authToken) {
      return false;
    }

    try {
      const accessToken = authToken.accessToken;
      const payload = jwtDecode(accessToken);

      // true if jwt is active
      const now = Date.now().valueOf() / 1000;
      return payload.exp >= now;
    } catch (err) {
      console.log("invalid jwt token", err);
      return false;
    }
  };

  const hasTokens = (): boolean => {
    return !!authToken;
  };

  const handleLogout = async () => {
    setAuthToken(null);
    setCurrentUser(null);
    Cookies.remove("authTokens");
    queryClient.clear();
    window.location.replace(APP_ROUTE.AUTH.LOGIN);;
  };

  const handleForgotPassword = async (data: IForgotPassword) => {
    setIsLoading(true);

    try {
      await forgotPassword(data);
      setIsLoading(false);

      return true;
    } catch (err) {
      console.log(err);
      setIsLoading(false);
      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });

      return false;
    }
  };

  const handleVerifyUserToken = async (data: IVerifyUserToken) => {
    setIsLoading(true);

    try {
      await verifyUserToken(data);
      setIsLoading(false);
    } catch (err) {
      console.log(err);
      setIsLoading(false);
      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };

  return {
    signIn: handleSignIn,
    invitationSignup: handleInvitationSignUp,
    setupWorkspace: handleSetupWorkspace,
    isAuthenticated: handleIsAuthenticated,
    forgotPassword: handleForgotPassword,
    passwordReset: handlePasswordReset,
    verifyUserToken: handleVerifyUserToken,
    logout: handleLogout,
    hasTokens,
    isLoading,
  };
}
