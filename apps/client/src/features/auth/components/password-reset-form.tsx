import { z } from "zod/v4";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import useAuth from "@/features/auth/hooks/use-auth";
import { Alert, Anchor, Box, Button, Container, PasswordInput, Title } from "@mantine/core";
import classes from "./auth.module.css";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "./auth-layout.tsx";
import { useAuthModeQuery } from "@/features/auth/queries/auth-query.tsx";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";

const formSchema = z.object({
  newPassword: z
    .string()
    .min(8, { message: "Password must contain at least 8 characters" }),
});
type FormValues = z.infer<typeof formSchema>;

interface PasswordResetFormProps {
  resetToken?: string;
}

export function PasswordResetForm({ resetToken }: PasswordResetFormProps) {
  const { t } = useTranslation();
  const { passwordReset, isLoading } = useAuth();
  const authModeQuery = useAuthModeQuery();
  useRedirectIfAuthenticated();

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      newPassword: "",
    },
  });

  async function onSubmit(data: FormValues) {
    await passwordReset({
      token: resetToken,
      newPassword: data.newPassword,
    });
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
          <Alert color="blue" title={t("Password reset unavailable")}>
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
          {t("Password reset")}
        </Title>

        <form onSubmit={form.onSubmit(onSubmit)}>
          <PasswordInput
            label={t("New password")}
            placeholder={t("Your new password")}
            variant="filled"
            mt="md"
            visibilityToggleButtonProps={{
              "aria-label": t("Toggle password visibility"),
              "aria-hidden": false,
              tabIndex: 0,
            }}
            {...form.getInputProps("newPassword")}
          />

          <Button type="submit" fullWidth mt="xl" loading={isLoading}>
            {t("Set password")}
          </Button>
        </form>
      </Box>
    </Container>
    </AuthLayout>
  );
}
