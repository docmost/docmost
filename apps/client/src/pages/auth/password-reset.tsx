import { PasswordResetForm } from "@/features/auth/components/password-reset-form";
import { Link, useSearchParams } from "react-router-dom";
import { useVerifyUserTokenQuery } from "@/features/auth/queries/auth-query";
import { Button, Container, Group, Text } from "@mantine/core";
import APP_ROUTE from "@/lib/app-route";
import { useTranslation } from "react-i18next";
import { DocumentTitle } from "@/components/ui/document-title.tsx";

export default function PasswordReset() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { data, isLoading, isError } = useVerifyUserTokenQuery({
    token: searchParams.get("token"),
    type: "forgot-password",
  });
  const resetToken = searchParams.get("token");

  if (isLoading) {
    return <div></div>;
  }

  if (isError || !resetToken) {
    return (
      <>
        <DocumentTitle title={t("Password Reset")} />
        <Container my={40}>
          <Text size="lg" ta="center">
            {t("Invalid or expired password reset link")}
          </Text>
          <Group justify="center">
            <Button
              component={Link}
              to={APP_ROUTE.AUTH.LOGIN}
              variant="subtle"
              size="md"
            >
              {t("Goto login page")}
            </Button>
          </Group>
        </Container>
      </>
    );
  }

  return (
    <>
      <DocumentTitle title={t("Password Reset")} />
      <PasswordResetForm resetToken={resetToken} />
    </>
  );
}
