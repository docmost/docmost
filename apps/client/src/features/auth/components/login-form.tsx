import * as z from "zod";
import { useForm, zodResolver } from "@mantine/form";
import useAuth from "@/features/auth/hooks/use-auth";
import { ILogin } from "@/features/auth/types/auth.types";
import {
  Container,
  Title,
  TextInput,
  Button,
  PasswordInput,
  Box,
  Anchor,
  Group,
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

const formSchemaLoginWithPassword = z.object({
  email: z.string().min(1, { message: "email is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const formSchemaLoginWithPasskey = z.object({
  email: z
    .string()
    .min(1, { message: "email is required" })
    .email({ message: "Invalid email address" }),
});

export function LoginForm() {
  const { t } = useTranslation();
  const { signIn, isLoading, handleSignInUsingPasskey } = useAuth();
  useRedirectIfAuthenticated();
  const {
    data,
    isLoading: isDataLoading,
    isError,
    error,
  } = useWorkspacePublicDataQuery();

  const form = useForm<ILogin>({
    initialValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: ILogin, event?: React.BaseSyntheticEvent) {
    // @ts-ignore
    const buttonClicked = event?.nativeEvent.submitter as HTMLButtonElement;
    const action = buttonClicked?.value;

    let validationResult: any;

    if (action === "signin") {
      validationResult = formSchemaLoginWithPassword.safeParse(data);
    } else if (action === "signin_with_passkey") {
      validationResult = formSchemaLoginWithPasskey.safeParse(data);
    }

    if (!validationResult.success) {
      const errors = validationResult.error.format();

      Object.keys(errors).forEach((field) => {
        const fieldErrors = (errors as any)[field]?._errors;
        if (fieldErrors?.length) {
          form.setFieldError(field as keyof ILogin, fieldErrors[0]);
        }
      });

      return;
    }

    if (action === "signin") {
      await signIn(data);
    } else {
      await handleSignInUsingPasskey(data);
    }
  }

  if (isDataLoading) {
   return null;
  }

  if (isError && error?.["response"]?.status === 404) {
    return <Error404 />;
  }

  return (
    <Container size={420} className={classes.container}>
      <Box p="xl" className={classes.containerBox}>
        <Title order={2} ta="center" fw={500} mb="md">
          {t("Login")}
        </Title>

        <SsoLogin />

        {!data?.enforceSso && (
          <>
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

              <Button type="submit" fullWidth mt="md" value="signin" loading={isLoading}>
                {t("Sign In")}
              </Button>
              <Button type="submit" fullWidth mt="xl" variant="default" value="signin_with_passkey" loading={isLoading}>
                {t("Sign In With Passkey")}
              </Button>
            </form>
          </>
        )}
      </Box>
    </Container>
  );
}
