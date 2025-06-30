import * as z from "zod";
import { useForm, zodResolver } from "@mantine/form";
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
  Alert,
  Text,
} from "@mantine/core";
import classes from "./auth.module.css";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import { useTranslation } from "react-i18next";
import SsoLogin from "@/ee/components/sso-login.tsx";
import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { Error404 } from "@/components/ui/error-404.tsx";
import React, { useState } from "react";
import { IconShield } from "@tabler/icons-react";
import { login } from "@/features/auth/services/auth-service";
import { notifications } from "@mantine/notifications";

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "email is required" })
    .email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
  totpToken: z.string().optional(),
});

export function LoginForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showTotpInput, setShowTotpInput] = useState(false);
  const [loginData, setLoginData] = useState<ILogin | null>(null);
  useRedirectIfAuthenticated();
  const {
    data,
    isLoading: isDataLoading,
    isError,
    error,
  } = useWorkspacePublicDataQuery();

  const form = useForm<ILogin & { totpToken?: string }>({
    validate: zodResolver(formSchema),
    initialValues: {
      email: "",
      password: "",
      totpToken: undefined,
    },
  });

  async function onSubmit(data: ILogin & { totpToken?: string }) {
    setIsLoading(true);
    
    try {
      if (showTotpInput && loginData) {
        const result = await login({
          email: loginData.email,
          password: loginData.password,
          totpToken: data.totpToken || "",
        });
        
        if (!result || !('requiresTotp' in result)) {
          window.location.href = "/";
        }
      } else {
        const loginPayload: ILogin = {
          email: data.email,
          password: data.password,
        };
        
        const result = await login(loginPayload);
        
        if (result && typeof result === 'object' && 'requiresTotp' in result) {
          setLoginData(data);
          setShowTotpInput(true);
          form.setFieldValue("totpToken", "");
        } else {
          window.location.href = "/";
        }
      }
    } catch (error) {
      let errorMessage = 'Login failed';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      if (showTotpInput && (errorMessage.includes('Invalid TOTP') || errorMessage.includes('TOTP'))) {
        errorMessage = t('Invalid verification code. Please try again.');
      }
      
      notifications.show({
        message: errorMessage,
        color: "red",
      });
      
      if (showTotpInput) {
        form.setFieldValue("totpToken", "");
      }
    } finally {
      setIsLoading(false);
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
              {showTotpInput && (
                <Alert icon={<IconShield size={16} />} mb="md" color="blue">
                  <Text size="sm" fw={500}>
                    {t("Two-Factor Authentication Required")}
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    {t("Please enter the verification code to complete your login")}
                  </Text>
                </Alert>
              )}

              {!showTotpInput && (
                <>
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
                </>
              )}

              {showTotpInput && (
                <>
                  <TextInput
                    label={t("Two-Factor Authentication Code")}
                    placeholder="123456"
                    variant="filled"
                    maxLength={8}
                    autoFocus
                    {...form.getInputProps("totpToken")}
                    description={t("Enter the 6-digit code from your authenticator app or an 8-character backup code")}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        form.onSubmit(onSubmit)();
                      }
                    }}
                  />
                  
                  <Group justify="space-between" mt="sm">
                    <Button
                      variant="default"
                      onClick={() => {
                        setShowTotpInput(false);
                        setLoginData(null);
                        form.setFieldValue("totpToken", "");
                      }}
                    >
                      {t("Back")}
                    </Button>
                  </Group>
                </>
              )}

              <Button type="submit" fullWidth mt="md" loading={isLoading}>
                {showTotpInput ? t("Verify") : t("Sign In")}
              </Button>
            </form>
          </>
        )}
      </Box>
    </Container>
  );
}
