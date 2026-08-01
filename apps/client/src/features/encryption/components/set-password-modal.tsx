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
import { WrongPasswordError } from "@/features/encryption/services/encryption-errors";

interface SetPasswordModalProps {
  opened: boolean;
  onClose: () => void;
  /** meta/dek are only generated in "enable" mode; null in "change" mode */
  onSubmit: (result: {
    meta: EncryptionMeta | null;
    dek: CryptoKey | null;
    password: string;
    /** only collected in "change" mode, to re-derive the section key */
    currentPassword: string;
  }) => Promise<void> | void;
  mode?: "enable" | "change";
}

const MIN_ENCRYPTION_PASSWORD_LENGTH = 12;
/** Keep KDF input bounded; extremely long strings are a mild client DoS. */
const MAX_ENCRYPTION_PASSWORD_LENGTH = 128;

interface FormValues {
  currentPassword: string;
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
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    initialValues: {
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
    validate: {
      currentPassword: (value) =>
        mode === "change" && value.length === 0
          ? t("Enter your current password")
          : null,
      // Longer than an account password deliberately: the wrapped key is
      // served to everyone with access to the space, so a weak one can be
      // attacked offline at the attacker's own pace rather than through a
      // login endpoint that can rate-limit.
      // measured on the normalized form, which is what actually reaches the
      // key derivation — otherwise combining characters could pad the count
      password: (value) => {
        const normalized = value.normalize("NFKC");
        if (normalized.length < MIN_ENCRYPTION_PASSWORD_LENGTH) {
          return t("Password must be a minimum of {{count}} characters", {
            count: MIN_ENCRYPTION_PASSWORD_LENGTH,
          });
        }
        if (normalized.length > MAX_ENCRYPTION_PASSWORD_LENGTH) {
          return t("Password must be at most {{count}} characters", {
            count: MAX_ENCRYPTION_PASSWORD_LENGTH,
          });
        }
        return null;
      },
      confirmPassword: (value, values) =>
        value !== values.password ? t("Passwords do not match") : null,
    },
  });

  function handleClose() {
    // never keep typed passwords around after the modal is dismissed
    form.reset();
    setSubmitError(null);
    onClose();
  }

  async function handleSubmit(values: FormValues) {
    setIsLoading(true);
    setSubmitError(null);
    try {
      if (mode === "change") {
        // caller re-derives the existing DEK from the current password and
        // re-wraps it; no new key material is generated
        await onSubmit({
          meta: null,
          dek: null,
          password: values.password,
          currentPassword: values.currentPassword,
        });
      } else {
        const { meta, dek } = await createEncryptionMeta(values.password);
        await onSubmit({
          meta,
          dek,
          password: values.password,
          currentPassword: "",
        });
      }
      // only clear the typed passwords once the operation actually succeeded
      form.reset();
    } catch (err) {
      // Keep the user in the form with what they typed, so they can correct a
      // mistyped password or retry a failed request. Nothing above this is a
      // caller that could report the error, so it is surfaced here rather than
      // rethrown into an unhandled rejection.
      if (err instanceof WrongPasswordError) {
        form.setFieldError("currentPassword", t("Wrong password"));
      } else {
        setSubmitError(
          err?.response?.data?.message ??
            t("Something went wrong. Please try again."),
        );
      }
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
            "If you forget this password, the page content is permanently unrecoverable.",
          )}
        </Text>
        <Text size="sm" mt="xs">
          {t("The page title stays unencrypted for navigation.")}
        </Text>
        {mode === "enable" && (
          <>
            <Text size="sm" mt="xs">
              {t(
                "Encrypting permanently deletes page history, comments, shares, backlinks, and any files attached to these pages.",
              )}
            </Text>
            <Text size="sm" mt="xs">
              {t(
                "Search, export, sharing and comments are disabled for encrypted pages.",
              )}
            </Text>
            <Text size="sm" mt="xs">
              {t(
                "Page history is kept encrypted and is only readable while the page is unlocked.",
              )}
            </Text>
          </>
        )}
        <Text size="sm" mt="xs">
          {t(
            "Use a strong, unique passphrase. Anyone with access to this space can try to crack the password offline.",
          )}
        </Text>
      </Alert>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        {mode === "change" && (
          <PasswordInput
            label={t("Current password")}
            placeholder={t("Enter your current password")}
            variant="filled"
            mb="md"
            data-autofocus
            autoComplete="current-password"
            visibilityToggleButtonProps={{
              "aria-label": t("Toggle password visibility"),
              "aria-hidden": false,
              tabIndex: 0,
            }}
            {...form.getInputProps("currentPassword")}
          />
        )}

        <PasswordInput
          label={mode === "change" ? t("New password") : t("Password")}
          placeholder={t("Enter a password")}
          variant="filled"
          mb="md"
          data-autofocus={mode !== "change"}
          autoComplete="new-password"
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
          autoComplete="new-password"
          visibilityToggleButtonProps={{
            "aria-label": t("Toggle password visibility"),
            "aria-hidden": false,
            tabIndex: 0,
          }}
          {...form.getInputProps("confirmPassword")}
        />

        {submitError && (
          <Text c="red" size="sm" mb="sm" role="alert">
            {submitError}
          </Text>
        )}

        <Group justify="flex-end" mt="md">
          <Button type="submit" disabled={isLoading} loading={isLoading}>
            {mode === "change" ? t("Change password") : t("Encrypt page")}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
