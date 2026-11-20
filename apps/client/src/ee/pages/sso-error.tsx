import { Link, useSearchParams } from "react-router-dom";
import { Container, Title, Text, Button, Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import classes from "../../features/auth/components/auth.module.css";
import APP_ROUTE from "@/lib/app-route.ts";
import { getAppUrl, getServerAppUrl, isCloud } from "@/lib/config.ts";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";
import { DocumentTitle } from "@/components/ui/document-title.tsx";

export default function SsoError() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const messages: Record<string, string> = {
    session_expired: t("Your sign-in attempt expired. Please try again."),
    provider_disabled: t(
      "This sign-in method is turned off for this workspace. Contact your workspace admin.",
    ),
    signup_disabled: t(
      "You don't have an account in this workspace yet. Ask an admin to invite you.",
    ),
    email_domain_not_allowed: t(
      "Your email domain isn't allowed in this workspace. Contact your workspace admin.",
    ),
    account_deactivated: t(
      "Your account has been deactivated. Contact your workspace admin.",
    ),
    identity_mismatch: t(
      "This email is linked to a different account at your identity provider. Contact your workspace admin.",
    ),
    email_missing: t(
      "Your identity provider didn't share an email address. Contact your workspace admin.",
    ),
    feature_unavailable: t(
      "Single sign-on isn't available on this workspace's plan. Contact your workspace admin.",
    ),
    sso_failed: t(
      "Something went wrong while signing you in. Try again, or contact your workspace admin if it keeps happening.",
    ),
  };

  const requested = searchParams.get("code");
  const code =
    requested && Object.keys(messages).includes(requested)
      ? requested
      : "sso_failed";

  const backTo =
    isCloud() && getAppUrl() === getServerAppUrl()
      ? APP_ROUTE.AUTH.SELECT_WORKSPACE
      : APP_ROUTE.AUTH.LOGIN;

  return (
    <>
      <DocumentTitle title={t("We couldn't sign you in")} />
      <AuthLayout>
        <Container size={420} className={classes.container}>
          <Box p="xl" className={classes.containerBox}>
            <Title order={2} ta="center" fw={500} mb="md">
              {t("We couldn't sign you in")}
            </Title>
            <Text ta="center" c="dimmed" mb="md">
              {messages[code]}
            </Text>
            <Text ta="center" size="xs" c="dimmed" mb="lg">
              {t("Error code: {{code}}", { code })}
            </Text>
            <Button fullWidth component={Link} to={backTo}>
              {t("Back to sign in")}
            </Button>
          </Box>
        </Container>
      </AuthLayout>
    </>
  );
}
