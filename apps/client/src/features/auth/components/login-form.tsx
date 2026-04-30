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
  rem,
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
import { getOAuthProviders, isOAuthEnabled } from "@/lib/config.ts";
import { IconBrandGit } from "@tabler/icons-react";

const formSchema = z.object({
  email: z.email().min(1, { message: "email is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});
type FormValues = z.infer<typeof formSchema>;

function MicrosoftIcon({ size = 16 }: { size?: number }) {
  const iconSize = rem(size);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 23 23"
      style={{ width: iconSize, height: iconSize }}
    >
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}

export function LoginForm() {
  const { t } = useTranslation();
  const { signIn, isLoading } = useAuth();
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

  function onOAuthLogin(provider: string) {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") || "/home";
    const loginParams = new URLSearchParams({ redirect });
    window.location.href = `/api/auth/oauth/${provider}/login?${loginParams.toString()}`;
  }

  const oauthProviders = {
    azure: {
      label: "Microsoft Azure",
      icon: <MicrosoftIcon size={16} />,
    },
    gitea: {
      label: "Gitea",
      icon: <IconBrandGit size={16} />,
    },
  };
  const enabledOAuthProviders = isOAuthEnabled()
    ? getOAuthProviders()
        .map((provider) => ({
          provider,
          config: oauthProviders[provider as keyof typeof oauthProviders],
        }))
        .filter(({ config }) => Boolean(config))
    : [];

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

                <Button type="submit" fullWidth mt="md" loading={isLoading}>
                  {t("Sign In")}
                </Button>
              </form>
            </>
          )}

          {enabledOAuthProviders.map(({ provider, config }, index) => (
            <Button
              key={provider}
              onClick={() => onOAuthLogin(provider)}
              leftSection={config.icon}
              variant="default"
              fullWidth
              mt={data?.enforceSso && index === 0 ? 0 : "md"}
            >
              Continue with {config.label}
            </Button>
          ))}
        </Box>
      </Container>
    </AuthLayout>
  );
}
