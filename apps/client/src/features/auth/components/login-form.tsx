import { z } from "zod/v4";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import useAuth from "@/features/auth/hooks/use-auth";
import {
  Alert,
  Container,
  Title,
  TextInput,
  Button,
  PasswordInput,
  Box,
  Anchor,
  Group,
  Stack,
} from "@mantine/core";
import classes from "./auth.module.css";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import { Link, useSearchParams } from "react-router-dom";
import APP_ROUTE, { getPostLoginRedirect } from "@/lib/app-route.ts";
import { useTranslation } from "react-i18next";
import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { Error404 } from "@/components/ui/error-404.tsx";
import React from "react";
import { AuthLayout } from "./auth-layout.tsx";
import { redirectToOidcLogin } from "@/features/oidc/services/oidc-service.ts";

const formSchema = z.object({
  email: z
    .email()
    .min(1, { message: "email is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});
type FormValues = z.infer<typeof formSchema>;

export function LoginForm() {
  const { t } = useTranslation();
  const { signIn, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  useRedirectIfAuthenticated();
  const {
    data,
    isLoading: isDataLoading,
    isError,
    error,
  } = useWorkspacePublicDataQuery();

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: FormValues) {
    await signIn(data);
  }

  const authProviders = data?.authProviders ?? [];
  const requiresOidc = data?.enforceSso ?? false;
  const oidcError = searchParams.get("error") === "oidc_failed";

  if (isDataLoading) {
   return null;
  }

  if (isError && error?.["response"]?.status === 404) {
    return <Error404 />;
  }

  return (
    <AuthLayout>
      <Container size={420} className={classes.container}>
        <Box p="xl" className={classes.containerBox}>
          <Title order={2} ta="center" fw={500} mb="md">
            {requiresOidc ? t("Continue with OIDC") : t("Login")}
          </Title>

          <Stack gap="md">
            {oidcError && (
              <Alert color="red">
                OIDC login failed. Check your provider configuration and try again.
              </Alert>
            )}

            {!requiresOidc && (
              <form onSubmit={form.onSubmit(onSubmit)}>
                <TextInput
                  id="email"
                  type="email"
                  label={t("Email")}
                  placeholder="email@example.com"
                  variant="filled"
                  {...form.getInputProps("email")}
                />

                <PasswordInput
                  label={t("Password")}
                  placeholder={t("Your password")}
                  variant="filled"
                  mt="md"
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

            {authProviders.length > 0 && (
              <Stack gap="xs">
                {authProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    variant={requiresOidc ? "filled" : "default"}
                    onClick={() =>
                      redirectToOidcLogin(provider.slug, getPostLoginRedirect())
                    }
                  >
                    Continue with {provider.name}
                  </Button>
                ))}
              </Stack>
            )}

            {requiresOidc && authProviders.length === 0 && (
              <Alert color="red">
                OIDC is required for this workspace, but no OIDC provider is enabled.
              </Alert>
            )}
          </Stack>
        </Box>
      </Container>
    </AuthLayout>
  );
}
