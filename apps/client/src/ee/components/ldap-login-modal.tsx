import React, { useState } from "react";
import { Modal, TextInput, PasswordInput, Button, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { z } from "zod";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IAuthProvider } from "@/ee/security/types/security.types";
import APP_ROUTE from "@/lib/app-route";
import { ldapLogin } from "@/ee/security/services/ldap-auth-service.ts";

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

interface LdapLoginModalProps {
  opened: boolean;
  onClose: () => void;
  provider: IAuthProvider;
  workspaceId: string;
}

export function LdapLoginModal({
  opened,
  onClose,
  provider,
  workspaceId,
}: LdapLoginModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    validate: zodResolver(formSchema),
    initialValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = async (values: { email: string; password: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await ldapLogin({
        email: values.email,
        password: values.password,
        providerId: provider.id,
        workspaceId,
      });

      // Handle MFA like the regular login
      if (response?.userHasMfa) {
        onClose();
        navigate(APP_ROUTE.AUTH.MFA_CHALLENGE);
      } else if (response?.requiresMfaSetup) {
        onClose();
        navigate(APP_ROUTE.AUTH.MFA_SETUP_REQUIRED);
      } else {
        onClose();
        navigate(APP_ROUTE.HOME);
      }
    } catch (err: any) {
      setIsLoading(false);
      const errorMessage =
        err.response?.data?.message || "Authentication failed";
      setError(errorMessage);

      notifications.show({
        message: errorMessage,
        color: "red",
      });
    }
  };

  const handleClose = () => {
    form.reset();
    setError(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={`Login with ${provider.name}`}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            id="ldap-email"
            type="email"
            label={t("Email")}
            placeholder="email@example.com"
            variant="filled"
            disabled={isLoading}
            data-autofocus
            {...form.getInputProps("email")}
          />

          <PasswordInput
            label={t("Password")}
            placeholder={t("Your password")}
            variant="filled"
            disabled={isLoading}
            {...form.getInputProps("password")}
          />

          <Button type="submit" fullWidth mt="md" loading={isLoading}>
            {t("Sign In")}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
