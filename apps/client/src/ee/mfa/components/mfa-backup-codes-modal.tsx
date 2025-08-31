import React, { useState } from "react";
import {
  Modal,
  Stack,
  Text,
  Button,
  Paper,
  Group,
  List,
  Code,
  CopyButton,
  Alert,
  PasswordInput,
} from "@mantine/core";
import {
  IconRefresh,
  IconCopy,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { regenerateBackupCodes } from "@/ee/mfa";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { z } from "zod";

interface MfaBackupCodesModalProps {
  opened: boolean;
  onClose: () => void;
}

const formSchema = z.object({
  confirmPassword: z.string().min(1, { message: "Password is required" }),
});

export function MfaBackupCodesModal({
  opened,
  onClose,
}: MfaBackupCodesModalProps) {
  const { t } = useTranslation();
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showNewCodes, setShowNewCodes] = useState(false);

  const form = useForm({
    validate: zodResolver(formSchema),
    initialValues: {
      confirmPassword: "",
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (data: { confirmPassword: string }) =>
      regenerateBackupCodes(data),
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      setShowNewCodes(true);
      form.reset();
      notifications.show({
        title: t("Success"),
        message: t("New backup codes have been generated"),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error"),
        message:
          error.response?.data?.message ||
          t("Failed to regenerate backup codes"),
        color: "red",
      });
    },
  });

  const handleRegenerate = (values: { confirmPassword: string }) => {
    regenerateMutation.mutate(values);
  };

  const handleClose = () => {
    setShowNewCodes(false);
    setBackupCodes([]);
    form.reset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Backup codes")}
      size="md"
    >
      <Stack gap="md">
        {!showNewCodes ? (
          <form onSubmit={form.onSubmit(handleRegenerate)}>
            <Stack gap="md">
              <Alert
                icon={<IconAlertCircle size={20} />}
                title={t("About backup codes")}
                color="blue"
                variant="light"
              >
                <Text size="sm">
                  {t(
                    "Backup codes can be used to access your account if you lose access to your authenticator app. Each code can only be used once.",
                  )}
                </Text>
              </Alert>

              <Text size="sm">
                {t(
                  "You can regenerate new backup codes at any time. This will invalidate all existing codes.",
                )}
              </Text>

              <PasswordInput
                label={t("Confirm password")}
                placeholder={t("Enter your password")}
                variant="filled"
                {...form.getInputProps("confirmPassword")}
              />

              <Button
                type="submit"
                fullWidth
                loading={regenerateMutation.isPending}
                leftSection={<IconRefresh size={18} />}
              >
                {t("Generate new backup codes")}
              </Button>
            </Stack>
          </form>
        ) : (
          <>
            <Alert
              icon={<IconAlertCircle size={20} />}
              title={t("Save your new backup codes")}
              color="yellow"
            >
              <Text size="sm">
                {t(
                  "Make sure to save these codes in a secure place. Your old backup codes are no longer valid.",
                )}
              </Text>
            </Alert>

            <Paper p="md" withBorder>
              <Group justify="space-between" mb="sm">
                <Text size="sm" fw={600}>
                  {t("Your new backup codes")}
                </Text>
                <CopyButton value={backupCodes.join("\n")}>
                  {({ copied, copy }) => (
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={copy}
                      leftSection={
                        copied ? (
                          <IconCheck size={14} />
                        ) : (
                          <IconCopy size={14} />
                        )
                      }
                    >
                      {copied ? t("Copied") : t("Copy")}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              <List size="sm" spacing="xs">
                {backupCodes.map((code, index) => (
                  <List.Item key={index}>
                    <Code>{code}</Code>
                  </List.Item>
                ))}
              </List>
            </Paper>

            <Button
              fullWidth
              onClick={handleClose}
              leftSection={<IconCheck size={18} />}
            >
              {t("I've saved my backup codes")}
            </Button>
          </>
        )}
      </Stack>
    </Modal>
  );
}
