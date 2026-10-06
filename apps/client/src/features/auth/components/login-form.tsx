import { z } from "zod/v4";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import useAuth from "@/features/auth/hooks/use-auth";
import {
  Container,
  Title,
  TextInput,
  Button,
  PasswordInput,
  Box,
  Anchor,
  Group,
  Alert,
} from "@mantine/core";
import classes from "./auth.module.css";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import { useTranslation } from "react-i18next";
import SsoLogin from "@/ee/components/sso-login.tsx";
import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { Error404 } from "@/components/ui/error-404.tsx";
import React from "react";
import { AuthLayout } from "./auth-layout.tsx";
import { useAuthModeQuery } from "@/features/auth/queries/auth-query.tsx";

const formSchema = z.object({
  email: z
    .email()
    .min(1, { message: "email is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});
type FormValues = z.infer<typeof formSchema>;

const ldapFormSchema = z.object({
  username: z.string().trim().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});
type LdapFormValues = z.infer<typeof ldapFormSchema>;

export function LoginForm() {
  const { t } = useTranslation();
  const { signIn, ldapSignIn, isLoading } = useAuth();
  useRedirectIfAuthenticated();
  const authModeQuery = useAuthModeQuery();
  const ldapOnly = authModeQuery.data?.ldapOnly === true;
  const {
    data,
    isLoading: isDataLoading,
    isError,
    error,
  } = useWorkspacePublicDataQuery(authModeQuery.data?.ldapOnly === false);

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      email: "",
      password: "",
    },
  });
  const ldapForm = useForm<LdapFormValues>({
    validate: zod4Resolver(ldapFormSchema),
    initialValues: { username: "", password: "" },
  });

  async function onSubmit(data: FormValues) {
    await signIn(data);
  }

  function handleValidationFailure(errors: Record<string, unknown>) {
    const firstInvalidId = Object.keys(errors)[0];
    if (firstInvalidId) {
      document.getElementById(firstInvalidId)?.focus();
    }
  }

  if (authModeQuery.isLoading) {
    return null;
  }

  if (authModeQuery.isError || !authModeQuery.data) {
    return (
      <AuthLayout>
        <Container size={420} className={classes.container}>
          <Alert
            title={t("Unable to load sign-in settings")}
            color="red"
            role="alert"
          >
            <Button
              variant="subtle"
              onClick={() => void authModeQuery.refetch()}
              mt="sm"
            >
              {t("Retry")}
            </Button>
          </Alert>
        </Container>
      </AuthLayout>
    );
  }

  if (!ldapOnly && isDataLoading) {
    return null;
  }

  if (!ldapOnly && isError && error?.["response"]?.status === 404) {
    return <Error404 />;
  }

  return (
    <AuthLayout>
      <Container size={420} className={classes.container}>
        <Box p="xl" className={classes.containerBox}>
          <Title order={1} size="h2" ta="center" fw={500} mb="md">
            {ldapOnly ? t("Sign in with LDAP") : t("Login")}
          </Title>

          {ldapOnly ? (
            <form onSubmit={ldapForm.onSubmit(ldapSignIn)}>
              <TextInput
                id="ldap-username"
                label={t("LDAP username")}
                placeholder={t("Enter your LDAP username")}
                variant="filled"
                autoComplete="username"
                data-autofocus
                errorProps={{ role: "alert" }}
                {...ldapForm.getInputProps("username")}
              />
              <PasswordInput
                id="ldap-password"
                label={t("LDAP password")}
                placeholder={t("Enter your LDAP password")}
                variant="filled"
                mt="md"
                autoComplete="current-password"
                errorProps={{ role: "alert" }}
                visibilityToggleButtonProps={{
                  "aria-label": t("Toggle password visibility"),
                  "aria-hidden": false,
                  tabIndex: 0,
                }}
                {...ldapForm.getInputProps("password")}
              />
              <Button type="submit" fullWidth mt="md" loading={isLoading}>
                {t("Sign In")}
              </Button>
            </form>
          ) : (
            <>
              <SsoLogin />

              {!data?.enforceSso && (
                <form onSubmit={form.onSubmit(onSubmit, handleValidationFailure)}>
                <TextInput
                  id="email"
                  type="email"
                  label={t("Email")}
                  placeholder="email@example.com"
                  variant="filled"
                  autoComplete="email"
                  errorProps={{ role: "alert" }}
                  {...form.getInputProps("email")}
                />

                <PasswordInput
                  id="password"
                  label={t("Password")}
                  placeholder={t("Your password")}
                  variant="filled"
                  mt="md"
                  autoComplete="current-password"
                  errorProps={{ role: "alert" }}
                  visibilityToggleButtonProps={{
                    "aria-label": t("Toggle password visibility"),
                    "aria-hidden": false,
                    tabIndex: 0,
                  }}
                  {...form.getInputProps("password")}
                />

                <Group justify="flex-end" mt="sm">
                  <Anchor
                    to={APP_ROUTE.AUTH.FORGOT_PASSWORD}
                    component={Link}
                    underline="never"
                    size="sm"
                  >
                    {t("Forgot your password?")}
                  </Anchor>
                </Group>

                <Button type="submit" fullWidth mt="md" loading={isLoading}>
                  {t("Sign In")}
                </Button>
                </form>
              )}
            </>
          )}
        </Box>
      </Container>
    </AuthLayout>
  );
}
