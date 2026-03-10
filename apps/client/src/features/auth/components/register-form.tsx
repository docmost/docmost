import * as z from "zod";
import { useForm, zodResolver } from "@mantine/form";
import useAuth from "@/features/auth/hooks/use-auth";
import { IRegister } from "@/features/auth/types/auth.types";
import {
  Container,
  Title,
  TextInput,
  Button,
  Box,
  Anchor,
  Group,
  Text,
  Alert,
} from "@mantine/core";
import classes from "./auth.module.css";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import { useTranslation } from "react-i18next";
import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import React from "react";

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email address" }),
});

export function RegisterForm() {
  const { t } = useTranslation();
  const { register, isLoading } = useAuth();
  useRedirectIfAuthenticated();

  const { data: workspaceData, isLoading: isDataLoading } = useWorkspacePublicDataQuery();

  const form = useForm<IRegister>({
    validate: zodResolver(formSchema),
    initialValues: {
      email: "",
    },
  });

  async function onSubmit(data: IRegister) {
    await register(data);
  }

  const emailAllowedDomains = workspaceData?.emailAllowedDomains || [];
  const enableRegistration = workspaceData?.enableRegistration;

  if (isDataLoading) {
    return (
      <Container size={420} className={classes.container}>
        <Box p="xl" className={classes.containerBox}>
          <Title order={2} ta="center" fw={500} mb="md">
            {t("Create account")}
          </Title>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            {t("Loading...")}
          </div>
        </Box>
      </Container>
    );
  }

  if (!enableRegistration) {
    return (
      <Container size={420} className={classes.container}>
        <Box p="xl" className={classes.containerBox}>
          <Title order={2} ta="center" fw={500} mb="md">
            {t("Create account")}
          </Title>
          <Text ta="center" c="dimmed">
            {t("Registration is not enabled. Please contact your administrator.")}
          </Text>
          <Group justify="center" mt="md">
            <Anchor
              to={APP_ROUTE.AUTH.LOGIN}
              component={Link}
              underline="never"
              size="sm"
            >
              {t("Back to login")}
            </Anchor>
          </Group>
        </Box>
      </Container>
    );
  }

  return (
    <Container size={420} className={classes.container}>
      <Box p="xl" className={classes.containerBox}>
        <Title order={2} ta="center" fw={500} mb="md">
          {t("Create account")}
        </Title>

        {emailAllowedDomains.length > 0 && (
          <Alert color="blue" mb="md">
            <Text size="sm">
              {t("Only emails with the following domains can register")}:{" "}
              <strong>{emailAllowedDomains.join(", ")}</strong>
            </Text>
          </Alert>
        )}

        <form onSubmit={form.onSubmit(onSubmit)}>
          <TextInput
            id="email"
            type="email"
            label={t("Email")}
            placeholder="email@example.com"
            variant="filled"
            {...form.getInputProps("email")}
          />

          <Button type="submit" fullWidth mt="xl" loading={isLoading}>
            {t("Send registration invitation")}
          </Button>

          <Group justify="center" mt="md">
            <Anchor
              to={APP_ROUTE.AUTH.LOGIN}
              component={Link}
              underline="never"
              size="sm"
            >
              {t("Already have an account? Sign in")}
            </Anchor>
          </Group>
        </form>
      </Box>
    </Container>
  );
}
