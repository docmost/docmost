import React from "react";
import {
  Modal,
  Stack,
  Text,
  Button,
  PasswordInput,
  Alert,
} from "@mantine/core";
import { IconShieldOff, IconAlertTriangle } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { disableMfa } from "@/ee/mfa";

interface MfaDisableModalProps {
  opened: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const formSchema = z.object({
  confirmPassword: z.string().min(1, { message: "Password is required" }),
});

export function MfaDisableModal({
  opened,
  onClose,
  onComplete,
}: MfaDisableModalProps) {
  const { t } = useTranslation();

  const form = useForm({
    validate: zodResolver(formSchema),
    initialValues: {
      confirmPassword: "",
    },
  });

  const disableMutation = useMutation({
    mutationFn: disableMfa,
    onSuccess: () => {
      onComplete();
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error"),
        message: error.response?.data?.message || t("Failed to disable MFA"),
        color: "red",
      });
    },
  });

  const handleSubmit = async (values: { confirmPassword: string }) => {
    await disableMutation.mutateAsync(values);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Disable two-factor authentication")}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Alert
            icon={<IconAlertTriangle size={20} />}
            title={t("Warning")}
            color="red"
            variant="light"
          >
            <Text size="sm">
              {t(
                "Disabling two-factor authentication will make your account less secure. You'll only need your password to sign in.",
              )}
            </Text>
          </Alert>

          <Text size="sm">
            {t(
              "Please enter your password to disable two-factor authentication:",
            )}
          </Text>

          <PasswordInput
            label={t("Password")}
            placeholder={t("Enter your password")}
            {...form.getInputProps("confirmPassword")}
            autoFocus
          />

          <Stack gap="sm">
            <Button
              type="submit"
              fullWidth
              color="red"
              loading={disableMutation.isPending}
              leftSection={<IconShieldOff size={18} />}
            >
              {t("Disable two-factor authentication")}
            </Button>
            <Button
              fullWidth
              variant="default"
              onClick={handleClose}
              disabled={disableMutation.isPending}
            >
              {t("Cancel")}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Modal>
  );
}
