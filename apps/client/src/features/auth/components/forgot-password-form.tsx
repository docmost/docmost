import { useState } from "react";
import { z } from "zod/v4";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import useAuth from "@/features/auth/hooks/use-auth";
import {
  Alert,
  Anchor,
  Box,
  Button,
  Container,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import classes from "./auth.module.css";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "./auth-layout.tsx";
import { useAuthModeQuery } from "@/features/auth/queries/auth-query.tsx";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";

const formSchema = z.object({
  email: z
    .email()
    .min(1, { message: "Email is required" }),
});
type FormValues = z.infer<typeof formSchema>;

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const { forgotPassword, isLoading } = useAuth();
  const authModeQuery = useAuthModeQuery();
  const [isTokenSent, setIsTokenSent] = useState<boolean>(false);
  useRedirectIfAuthenticated();

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      email: "",
    },
  });

  async function onSubmit(data: FormValues) {
    if (await forgotPassword(data)) {
      setIsTokenSent(true);
    }
  }

  if (authModeQuery.isLoading) {
    return null;
  }

  if (authModeQuery.isError || !authModeQuery.data) {
    return <div>{t("Unable to load sign-in settings")}</div>;
  }

  if (authModeQuery.data.ldapOnly) {
    return (
      <AuthLayout>
        <Container size={420} className={classes.container}>
          <Alert color="blue" title={t("Password recovery unavailable")}>
            {t("Sign in using your LDAP credentials instead.")}
            <Anchor component={Link} to={APP_ROUTE.AUTH.LOGIN} display="block" mt="md">
              {t("Sign in")}
            </Anchor>
          </Alert>
        </Container>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
    <Container size={420} className={classes.container}>
      <Box p="xl" className={classes.containerBox}>
        <Title order={2} ta="center" fw={500} mb="md">
          {t("Forgot password")}
        </Title>

        <form onSubmit={form.onSubmit(onSubmit)}>
          {!isTokenSent && (
            <TextInput
              id="email"
              type="email"
              label="Email"
              placeholder="email@example.com"
              variant="filled"
              {...form.getInputProps("email")}
            />
          )}

          {isTokenSent && (
            <Text>
              {t(
                "A password reset link has been sent to your email. Please check your inbox.",
              )}
            </Text>
          )}

          {!isTokenSent && (
            <Button type="submit" fullWidth mt="xl" loading={isLoading}>
              {t("Send reset link")}
            </Button>
          )}
        </form>
      </Box>
    </Container>
    </AuthLayout>
  );
}
