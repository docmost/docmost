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
  Anchor,
  Text,
} from "@mantine/core";
import { ISignup } from "@/features/auth/types/auth.types";
import useAuth from "@/features/auth/hooks/use-auth";
import classes from "@/features/auth/components/auth.module.css";
import { useTranslation } from "react-i18next";
import SsoCloudSignup from "@/ee/components/sso-cloud-signup.tsx";
import { isCloud } from "@/lib/config.ts";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";

const formSchema = z.object({
  name: z.string().min(1).max(50),
  email: z
    .string()
    .min(1, { message: "email is required" })
    .email({ message: "Invalid email address" }),
  password: z.string().min(8),
});

export function SignupForm() {
  const { t } = useTranslation();
  const { signupUser, isLoading } = useAuth();
  // useRedirectIfAuthenticated();

  const form = useForm<ISignup>({
    validate: zodResolver(formSchema),
    initialValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: ISignup) {
    await signupUser(data);
  }

  return (
    <div>
      <Container size={420} className={classes.container}>
        <Box p="xl" className={classes.containerBox}>
          <Title order={2} ta="center" fw={500} mb="md">
            {t("Sign Up")}
          </Title>

          {isCloud() && <SsoCloudSignup />}

          <form onSubmit={form.onSubmit(onSubmit)}>            
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
              {t("Sign Up")}
            </Button>
          </form>
        </Box>
      </Container>
    </div>
  );
}
