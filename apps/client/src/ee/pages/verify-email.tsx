import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Container, Title, Text, Button, Box } from "@mantine/core";
import classes from "../../features/auth/components/auth.module.css";
import {
  verifyEmail,
  resendVerificationEmail,
} from "@/ee/cloud/service/cloud-service.ts";
import { notifications } from "@mantine/notifications";
import APP_ROUTE from "@/lib/app-route.ts";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const rawEmail = searchParams.get("email");
  const email = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;
  const sig = searchParams.get("sig");
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (token) {
      handleVerify(token);
    }
  }, [token]);

  async function handleVerify(verifyToken: string) {
    try {
      await verifyEmail({ token: verifyToken });
      navigate(APP_ROUTE.HOME);
    } catch (err) {
      notifications.show({
        message: t("Verification failed. The link may have expired."),
        color: "red",
      });
      navigate(APP_ROUTE.AUTH.LOGIN);
    }
  }

  async function handleResend() {
    if (!email || !sig) return;
    setIsResending(true);

    try {
      await resendVerificationEmail({ email, sig });
      setResent(true);
    } catch {
      notifications.show({
        message: t("Failed to resend verification email. Please try again."),
        color: "red",
      });
    }

    setIsResending(false);
  }

  if (token) {
    return (
      <AuthLayout>
        <Container size={420} className={classes.container}>
          <Box p="xl" className={classes.containerBox}>
            <Title order={2} ta="center" fw={500} mb="md">
              {t("Verifying your email")}
            </Title>
            <Text ta="center" c="dimmed">
              {t("Please wait...")}
            </Text>
          </Box>
        </Container>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
    <Container size={420} className={classes.container}>
      <Box p="xl" className={classes.containerBox}>
        <Title order={2} ta="center" fw={500} mb="md">
          {t("Check your email")}
        </Title>
        <Text ta="center" c="dimmed" mb="md">
          {email
            ? t("We sent a verification link to {{email}}.", { email })
            : t("We sent a verification link to your email.")}
        </Text>
        <Text ta="center" size="sm" c="dimmed" mb="lg">
          {t("Click the link to verify your email and access your workspace.")}
        </Text>
        {email && sig && !resent && (
          <Button
            fullWidth
            variant="light"
            onClick={handleResend}
            loading={isResending}
          >
            {t("Resend verification email")}
          </Button>
        )}
        {resent && (
          <Text ta="center" size="sm" c="dimmed">
            {t("Verification email sent. Please check your inbox.")}
          </Text>
        )}
      </Box>
    </Container>
    </AuthLayout>
  );
}
