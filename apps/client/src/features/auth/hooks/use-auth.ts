import { useState } from "react";
import {
  forgotPassword,
  login,
  ldapLogin,
  logout,
  passwordReset,
  setupWorkspace,
  setupWorkspaceWithLdap,
  verifyUserToken,
} from "@/features/auth/services/auth-service";
import { useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  IForgotPassword,
  ILogin,
  ILdapLogin,
  ILdapSetup,
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
import APP_ROUTE, { getPostLoginRedirect } from "@/lib/app-route.ts";
import { RESET } from "jotai/utils";
import { useTranslation } from "react-i18next";
import { isCloud } from "@/lib/config.ts";
import { exchangeTokenRedirectUrl, getHostnameUrl } from "@/ee/utils.ts";

export default function useAuth() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [, setCurrentUser] = useAtom(currentUserAtom);

  const navigateAfterLogin = (response?: { userHasMfa?: boolean; requiresMfaSetup?: boolean }) => {
    if (response?.userHasMfa) {
      navigate(APP_ROUTE.AUTH.MFA_CHALLENGE + window.location.search);
    } else if (response?.requiresMfaSetup) {
      navigate(APP_ROUTE.AUTH.MFA_SETUP_REQUIRED + window.location.search);
    } else {
      navigate(getPostLoginRedirect());
    }
  };

  const handleSignIn = async (data: ILogin) => {
    setIsLoading(true);

    try {
      const response = await login(data);
      setIsLoading(false);

      navigateAfterLogin(response);
    } catch (err) {
      setIsLoading(false);

      const message = err.response?.data?.message;
      if (isCloud() && message?.includes("verify your email")) {
        const sig = err.response?.data?.emailSignature;
        navigate(
          `${APP_ROUTE.AUTH.VERIFY_EMAIL}?email=${encodeURIComponent(data.email)}${sig ? `&sig=${sig}` : ""}`,
        );
        return;
      }

      notifications.show({
        message,
        color: "red",
      });
    }
  };

  const handleLdapSignIn = async (data: ILdapLogin) => {
    setIsLoading(true);
    try {
      const response = await ldapLogin(data);
      setIsLoading(false);
      navigateAfterLogin(response);
    } catch (err) {
      setIsLoading(false);
      notifications.show({
        message: err.response?.data?.message || t("Authentication failed"),
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

        if (res?.requiresEmailVerification) {
          const hostname = res?.workspace?.hostname;
          if (hostname) {
            window.location.href =
              getHostnameUrl(hostname) +
              `/verify-email?email=${encodeURIComponent(data.email)}&sig=${res.emailSignature}`;
          }
          return;
        }

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

  const handleSetupWorkspaceWithLdap = async (data: ILdapSetup) => {
    setIsLoading(true);
    try {
      const response = await setupWorkspaceWithLdap(data);
      setIsLoading(false);
      if ("userHasMfa" in response || "requiresMfaSetup" in response) {
        navigateAfterLogin(response);
      } else {
        navigate(APP_ROUTE.HOME);
      }
    } catch (err) {
      setIsLoading(false);
      notifications.show({
        message: err.response?.data?.message || t("Unable to create workspace"),
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
    window.location.replace(`${APP_ROUTE.AUTH.LOGIN}?logout=1`);
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
    ldapSignIn: handleLdapSignIn,
    invitationSignup: handleInvitationSignUp,
    setupWorkspace: handleSetupWorkspace,
    setupWorkspaceWithLdap: handleSetupWorkspaceWithLdap,
    forgotPassword: handleForgotPassword,
    passwordReset: handlePasswordReset,
    verifyUserToken: handleVerifyUserToken,
    logout: handleLogout,
    isLoading,
  };
}
