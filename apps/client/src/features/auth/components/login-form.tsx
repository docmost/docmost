import * as React from "react";
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
  UnstyledButton,
} from "@mantine/core";
import classes from "./auth.module.css";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import clsx from "clsx";
import {useNavigate} from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "email is required" })
    .email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export function LoginForm() {
  const { signIn, isLoading } = useAuth();
  const navigate = useNavigate();
  useRedirectIfAuthenticated();

  const form = useForm<ILogin>({
    validate: zodResolver(formSchema),
    initialValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: ILogin) {
    await signIn(data);
  }

  return (
    <Container size={420} my={40} className={classes.container}>
      <Box p="xl" mt={200}>
        <Title order={2} ta="center" fw={500} mb="md">
          Login
        </Title>

        <form onSubmit={form.onSubmit(onSubmit)}>
          <TextInput
            id="email"
            type="email"
            label="Email"
            placeholder="email@example.com"
            variant="filled"
            {...form.getInputProps("email")}
          />

          <PasswordInput
            label="Password"
            placeholder="Your password"
            variant="filled"
            mt="md"
            {...form.getInputProps("password")}
          />

          <UnstyledButton
              onClick={() => navigate(APP_ROUTE.AUTH.FORGOT_PASSWORD)}
              className = {clsx(classes.forgotPasswordBtn, classes.formElemWithTopMargin)}>
            <div>
              <span>Forgot Password</span>
            </div>
          </UnstyledButton>
          <Button type="submit" fullWidth mt="xl" loading={isLoading}>
            Sign In
          </Button>
        </form>
      </Box>
    </Container>
  );
}
