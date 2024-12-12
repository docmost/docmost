import * as React from "react";
import * as z from "zod";

import { useForm, zodResolver } from "@mantine/form";
import {
  Container,
  Title,
  TextInput,
  Button,
  PasswordInput,
  Box,
} from "@mantine/core";
import { ISetupWorkspace } from "@/features/auth/types/auth.types";
import useAuth from "@/features/auth/hooks/use-auth";
import classes from "@/features/auth/components/auth.module.css";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  workspaceName: z.string().trim().min(3).max(50),
  name: z.string().min(1).max(50),
  email: z
    .string()
    .min(1, { message: "email is required" })
    .email({ message: "Invalid email address" }),
  password: z.string().min(8),
});

export function SetupWorkspaceForm() {
  const { setupWorkspace, isLoading } = useAuth();
  // useRedirectIfAuthenticated();

  const { t } = useTranslation();
  const form = useForm<ISetupWorkspace>({
    validate: zodResolver(formSchema),
    initialValues: {
      workspaceName: "",
      name: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: ISetupWorkspace) {
    await setupWorkspace(data);
  }

  return (
    <Container size={420} my={40} className={classes.container}>
      <Box p="xl" mt={200}>
        <Title order={2} ta="center" fw={500} mb="md">
          {t("Create workspace")}
        </Title>

        <form onSubmit={form.onSubmit(onSubmit)}>
          <TextInput
            id="workspaceName"
            type="text"
            label={t("Workspace Name")}
            placeholder={t("e.g ACME Inc")}
            variant="filled"
            mt="md"
            {...form.getInputProps("workspaceName")}
          />

          <TextInput
            id="name"
            type="text"
            label={t("Your Name")}
            placeholder={t("enter your full name")}
            variant="filled"
            mt="md"
            {...form.getInputProps("name")}
          />

          <TextInput
            id="email"
            type="email"
            label={t("Your Email")}
            placeholder="email@example.com"
            variant="filled"
            mt="md"
            {...form.getInputProps("email")}
          />

          <PasswordInput
            label={t("Password")}
            placeholder={t("Enter a strong password")}
            variant="filled"
            mt="md"
            {...form.getInputProps("password")}
          />
          <Button type="submit" fullWidth mt="xl" loading={isLoading}>
            {t("Setup workspace")}
          </Button>
        </form>
      </Box>
    </Container>
  );
}
