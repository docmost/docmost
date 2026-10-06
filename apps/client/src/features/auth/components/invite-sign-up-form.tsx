import * as React from "react";
import { z } from "zod/v4";

import { useForm } from "@mantine/form";
import {
  Container,
  Title,
  TextInput,
  Button,
  PasswordInput,
  Box,
  Stack,
  Alert,
  Anchor,
} from "@mantine/core";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { useParams, useSearchParams } from "react-router-dom";
import useAuth from "@/features/auth/hooks/use-auth";
import classes from "@/features/auth/components/auth.module.css";
import { useGetInvitationQuery } from "@/features/workspace/queries/workspace-query.ts";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import { useTranslation } from "react-i18next";
import SsoLogin from "@/ee/components/sso-login.tsx";
import { AuthLayout } from "./auth-layout.tsx";
import { useAuthModeQuery } from "@/features/auth/queries/auth-query.tsx";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";

const formSchema = z.object({
  name: z.string().trim().min(1),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof formSchema>;

export function InviteSignUpForm() {
  const { t } = useTranslation();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const { data: invitation, isError } = useGetInvitationQuery(
    params?.invitationId,
  );
  const { invitationSignup, isLoading } = useAuth();
  const authModeQuery = useAuthModeQuery();
  useRedirectIfAuthenticated();

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      name: "",
      password: "",
    },
  });

  async function onSubmit(data: FormValues) {
    const invitationToken = searchParams.get("token");

    await invitationSignup({
      invitationId: invitation.id,
      name: data.name,
      password: data.password,
      token: invitationToken,
    });
  }

  if (authModeQuery.isLoading) {
    return null;
  }

  if (authModeQuery.isError || !authModeQuery.data) {
    return <div>{t("Unable to load sign-in settings")}</div>;
  }

  if (isError) {
    return <div>{t("invalid invitation link")}</div>;
  }

  if (!invitation) {
    return <div></div>;
  }

  if (authModeQuery.data.ldapOnly) {
    return (
      <AuthLayout>
        <Container size={420} className={classes.container}>
          <Box p="xl" className={classes.containerBox}>
            <Title order={2} ta="center" fw={500} mb="md">
              {t("LDAP sign-in required")}
            </Title>
            <Alert color="blue">
              {t(
                "This deployment uses LDAP authentication. Sign in with your directory account to join the workspace.",
              )}
              <Anchor component={Link} to={APP_ROUTE.AUTH.LOGIN} display="block" mt="md">
                {t("Sign in")}
              </Anchor>
            </Alert>
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
          {t("Join the workspace")}
        </Title>

        <SsoLogin />

        {!invitation.enforceSso && (
          <Stack align="stretch" justify="center" gap="xl">
            <form onSubmit={form.onSubmit(onSubmit)}>
              <TextInput
                id="name"
                type="text"
                label={t("Name")}
                placeholder={t("enter your full name")}
                variant="filled"
                {...form.getInputProps("name")}
              />

              <TextInput
                id="email"
                type="email"
                label={t("Email")}
                value={invitation.email}
                disabled
                variant="filled"
                mt="md"
              />

              <PasswordInput
                label={t("Password")}
                placeholder={t("Your password")}
                variant="filled"
                mt="md"
                visibilityToggleButtonProps={{
                  "aria-label": t("Toggle password visibility"),
                  "aria-hidden": false,
                  tabIndex: 0,
                }}
                {...form.getInputProps("password")}
              />
              <Button type="submit" fullWidth mt="xl" loading={isLoading}>
                {t("Sign Up")}
              </Button>
            </form>
          </Stack>
        )}
      </Box>
    </Container>
    </AuthLayout>
  );
}
