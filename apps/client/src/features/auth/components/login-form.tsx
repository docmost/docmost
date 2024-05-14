import * as React from "react";
import * as z from "zod";

import { useForm, zodResolver } from "@mantine/form";
import useAuth from "@/features/auth/hooks/use-auth";
import { ILogin } from "@/features/auth/types/auth.types";
import {
  Container,
  Title,
  Anchor,
  TextInput,
  Button,
  Text,
  PasswordInput,
  Box,
} from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";
import classes from "./auth.module.css";
import { useEffect, useState } from "react";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "email is required" })
    .email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export function LoginForm() {
  const { signIn, isLoading } = useAuth();
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
          <Button type="submit" fullWidth mt="xl" loading={isLoading}>
            Sign In
          </Button>
        </form>

        <Text c="dimmed" size="sm" ta="center" mt="sm">
          Don't have an account yet?{" "}
          <Anchor size="sm" component={Link} to="/signup">
            Create account
          </Anchor>
        </Text>
      </Box>
    </Container>
  );
}
