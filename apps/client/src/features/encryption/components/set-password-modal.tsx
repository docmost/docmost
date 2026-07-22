import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  PasswordInput,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types";
import { createEncryptionMeta } from "@/features/encryption/services/crypto";

interface SetPasswordModalProps {
  opened: boolean;
  onClose: () => void;
  /** meta/dek are only generated in "enable" mode; null in "change" mode */
  onSubmit: (result: {
    meta: EncryptionMeta | null;
    dek: CryptoKey | null;
    password: string;
  }) => Promise<void> | void;
  mode?: "enable" | "change";
}

interface FormValues {
  password: string;
  confirmPassword: string;
}

export function SetPasswordModal({
  opened,
  onClose,
  onSubmit,
  mode = "enable",
}: SetPasswordModalProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    initialValues: {
      password: "",
      confirmPassword: "",
    },
    validate: {
      password: (value) =>
        value.length < 8
          ? t("Password must be a minimum of 8 characters")
          : null,
      confirmPassword: (value, values) =>
        value !== values.password ? t("Passwords do not match") : null,
    },
  });

  function handleClose() {
    // never keep typed passwords around after the modal is dismissed
    form.reset();
    onClose();
  }

  async function handleSubmit(values: FormValues) {
    setIsLoading(true);
    try {
      if (mode === "change") {
        // caller re-wraps the existing DEK; no new key material needed
        await onSubmit({ meta: null, dek: null, password: values.password });
      } else {
        const { meta, dek } = await createEncryptionMeta(values.password);
        await onSubmit({ meta, dek, password: values.password });
      }
      form.reset();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={mode === "change" ? t("Change page password") : t("Encrypt page")}
      centered
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
    >
      <Alert
        icon={<IconAlertTriangle size={18} />}
        color="red"
        variant="light"
        mb="md"
      >
        <Text size="sm">
          {t(
            "If you forget this password, the page content is permanently unrecoverable. The page title stays unencrypted for navigation. Search, export, sharing, comments and page history are disabled for encrypted pages.",
          )}
        </Text>
      </Alert>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <PasswordInput
          label={t("Password")}
          placeholder={t("Enter a password")}
          variant="filled"
          mb="md"
          data-autofocus
          visibilityToggleButtonProps={{
            "aria-label": t("Toggle password visibility"),
            "aria-hidden": false,
            tabIndex: 0,
          }}
          {...form.getInputProps("password")}
        />

        <PasswordInput
          label={t("Confirm password")}
          placeholder={t("Confirm your password")}
          variant="filled"
          mb="md"
          visibilityToggleButtonProps={{
            "aria-label": t("Toggle password visibility"),
            "aria-hidden": false,
            tabIndex: 0,
          }}
          {...form.getInputProps("confirmPassword")}
        />

        <Group justify="flex-end" mt="md">
          <Button type="submit" disabled={isLoading} loading={isLoading}>
            {mode === "change" ? t("Change password") : t("Encrypt page")}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
