import * as React from "react";
import * as z from "zod";

import { useForm, zodResolver } from "@mantine/form";
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
import { Link } from "react-router-dom";
import { IRegister } from "@/features/auth/types/auth.types";
import useAuth from "@/features/auth/hooks/use-auth";
import classes from "@/features/auth/components/auth.module.css";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "email is required" })
    .email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export function SignUpForm() {
  const { signUp, isLoading } = useAuth();
  useRedirectIfAuthenticated();

  const form = useForm<IRegister>({
    validate: zodResolver(formSchema),
    initialValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: IRegister) {
    await signUp(data);
  }

  return (
    <Container size={420} my={40} className={classes.container}>
      <Box p="xl" mt={200}>
        <Title order={2} ta="center" fw={500} mb="md">
          Create an account
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
            Sign Up
          </Button>
        </form>

        <Text c="dimmed" size="sm" ta="center" mt="sm">
          Already have an account?{" "}
          <Anchor size="sm" component={Link} to="/login">
            Login
          </Anchor>
        </Text>
      </Box>
    </Container>
  );
}
