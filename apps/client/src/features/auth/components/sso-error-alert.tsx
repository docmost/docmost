import { Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * The Google callback cannot render UI, so it redirects back to /login with an
 * opaque `?error=` code. This turns that code into a message.
 */
export default function SsoErrorAlert() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("error");

  if (!code) return null;

  const messages: Record<string, string> = {
    google_sso_disabled: t("Google sign-in is not enabled for this workspace."),
    google_sign_in_failed: t("Google sign-in failed. Please try again."),
    google_sign_in_cancelled: t("Google sign-in was cancelled."),
    invalid_state: t("Your sign-in session expired. Please try again."),
    email_not_verified: t("Your Google email address is not verified."),
    email_domain_not_allowed: t(
      "Your email domain is not approved for this workspace.",
    ),
    signup_not_allowed: t(
      "No account matches this Google address, and signup is disabled.",
    ),
    account_disabled: t("This account is deactivated."),
    mfa_required: t(
      "This account uses two-factor authentication. Please sign in with your email and password.",
    ),
    admin_link_not_allowed: t(
      "This address belongs to an admin account with a password. Sign in with your password instead.",
    ),
    workspace_not_found: t("Workspace not found."),
  };

  return (
    <Alert
      variant="light"
      color="red"
      icon={<IconAlertCircle />}
      mb="md"
      role="alert"
    >
      {messages[code] ?? t("Sign-in failed. Please try again.")}
    </Alert>
  );
}
