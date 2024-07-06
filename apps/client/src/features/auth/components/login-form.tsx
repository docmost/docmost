import * as React from "react";
import * as z from "zod";
import { useForm, zodResolver } from "@mantine/form";
import useAuth from "@/features/auth/hooks/use-auth";
import { ILogin, IOIDCConfig } from "@/features/auth/types/auth.types";
import {
  Container,
  Title,
  TextInput,
  Button,
  PasswordInput,
  Box,
} from "@mantine/core";
import classes from "./auth.module.css";
import { useRedirectIfAuthenticated } from "@/features/auth/hooks/use-redirect-if-authenticated.ts";
import { useEffect } from "react";
import api from "@/lib/api-client";

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "email is required" })
    .email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export function LoginForm() {
  const { signIn, isLoading } = useAuth();

  const [buttonName, setButtonName] = React.useState<string>("Login with OIDC");
  const [oidcEnabled, setOidcEnabled] = React.useState<boolean>(false);

  useRedirectIfAuthenticated();

  useEffect(() => {

    const fetchConfig = async () => {
      const response = await api.get<IOIDCConfig>("/auth/oidc-config");

      setButtonName(response.data.buttonName);
      setOidcEnabled(response.data.enabled);
    };
  
    fetchConfig();
  })

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

  async function loginWithOAuth() {
    window.location.href = "/api/auth/oauth-redirect";
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
            Login
          </Button>
          {oidcEnabled && 
            <Button onClick={loginWithOAuth} hidden={!oidcEnabled} fullWidth mt="sm">
              Login with {buttonName}
            </Button>
          }
        </form>
      </Box>
    </Container>
  );
}
