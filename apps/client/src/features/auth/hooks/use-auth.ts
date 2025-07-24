import { useState } from "react";
import {
  forgotPassword,
  login,
  logout,
  passwordReset,
  setupWorkspace,
  verifyUserToken,
} from "@/features/auth/services/auth-service";
import { useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
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
import {
  acceptInvitation,
  createWorkspace,
} from "@/features/workspace/services/workspace-service.ts";
import APP_ROUTE from "@/lib/app-route.ts";
import { RESET } from "jotai/utils";
import { useTranslation } from "react-i18next";
import { isCloud } from "@/lib/config.ts";
import { exchangeTokenRedirectUrl } from "@/ee/utils.ts";

export default function useAuth() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [, setCurrentUser] = useAtom(currentUserAtom);

  const handleSignIn = async (data: ILogin) => {
    setIsLoading(true);

    try {
      const response = await login(data);
      setIsLoading(false);

      // Check if MFA is required
      if (response?.userHasMfa) {
        navigate(APP_ROUTE.AUTH.MFA_CHALLENGE);
      } else if (response?.requiresMfaSetup) {
        navigate(APP_ROUTE.AUTH.MFA_SETUP_REQUIRED);
      } else {
        navigate(APP_ROUTE.HOME);
      }
    } catch (err) {
      setIsLoading(false);
      console.log(err);
      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };

  const handleInvitationSignUp = async (data: IAcceptInvite) => {
    setIsLoading(true);

    try {
      const response = await acceptInvitation(data);
      setIsLoading(false);

      if (response?.requiresLogin) {
        notifications.show({
          message: t(
            "Account created successfully. Please log in to set up two-factor authentication.",
          ),
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
      } else {
        navigate(APP_ROUTE.HOME);
      }
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
      if (isCloud()) {
        const res = await createWorkspace(data);
        const hostname = res?.workspace?.hostname;
        const exchangeToken = res?.exchangeToken;
        if (hostname && exchangeToken) {
          window.location.href = exchangeTokenRedirectUrl(
            hostname,
            exchangeToken,
          );
        }
      } else {
        const res = await setupWorkspace(data);
        setIsLoading(false);
        navigate(APP_ROUTE.HOME);
      }
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
      const response = await passwordReset(data);
      setIsLoading(false);

      if (response?.requiresLogin) {
        notifications.show({
          message: t(
            "Password reset was successful. Please log in with your new password.",
          ),
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
      } else {
        navigate(APP_ROUTE.HOME);
        notifications.show({
          message: t("Password reset was successful"),
        });
      }
    } catch (err) {
      setIsLoading(false);
      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };

  const handleLogout = async () => {
    setCurrentUser(RESET);
    await logout();
    window.location.replace(APP_ROUTE.AUTH.LOGIN);
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
    forgotPassword: handleForgotPassword,
    passwordReset: handlePasswordReset,
    verifyUserToken: handleVerifyUserToken,
    logout: handleLogout,
    isLoading,
  };
}
