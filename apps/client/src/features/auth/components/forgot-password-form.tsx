import { useState } from "react";
import * as z from "zod";
import { useForm, zodResolver } from "@mantine/form";
import useAuth from "@/features/auth/hooks/use-auth";
import { IForgotPassword } from "@/features/auth/types/auth.types";
import { Box, Button, Container, Text, TextInput, Title } from "@mantine/core";
import classes from "./auth.module.css";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email address" }),
});

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const { forgotPassword, isLoading } = useAuth();
  const [isTokenSent, setIsTokenSent] = useState<boolean>(false);
  useRedirectIfAuthenticated();

  const form = useForm<IForgotPassword>({
    validate: zodResolver(formSchema),
    initialValues: {
      email: "",
    },
  });

  async function onSubmit(data: IForgotPassword) {
    if (await forgotPassword(data)) {
      setIsTokenSent(true);
    }
  }

  return (
    <Container size={420} className={classes.container}>
      <Box p="xl" className={classes.containerBox}>
        <Title order={2} ta="center" fw={500} mb="md">
          {t("Forgot password")}
        </Title>

        <form onSubmit={form.onSubmit(onSubmit)}>
          {!isTokenSent && (
            <TextInput
              id="email"
              type="email"
              label="Email"
              placeholder="email@example.com"
              variant="filled"
              {...form.getInputProps("email")}
            />
          )}

          {isTokenSent && (
            <Text>
              {t(
                "A password reset link has been sent to your email. Please check your inbox.",
              )}
            </Text>
          )}

          {!isTokenSent && (
            <Button type="submit" fullWidth mt="xl" loading={isLoading}>
              {t("Send reset link")}
            </Button>
          )}
        </form>
      </Box>
    </Container>
  );
}
