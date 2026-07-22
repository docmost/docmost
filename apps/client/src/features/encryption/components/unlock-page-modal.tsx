import { useState } from "react";
import { Button, Group, Modal, PasswordInput, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  EncryptionMeta,
  WrongPasswordError,
} from "@/features/encryption/types/encryption.types";
import { unlockDek } from "@/features/encryption/services/crypto";

interface UnlockPageModalProps {
  opened: boolean;
  onClose: () => void;
  encryptionMeta: EncryptionMeta;
  onUnlocked: (dek: CryptoKey) => void;
  pageTitle?: string;
}

export function UnlockPageModal({
  opened,
  onClose,
  encryptionMeta,
  onUnlocked,
  pageTitle,
}: UnlockPageModalProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleClose() {
    // never keep a typed password around after the modal is dismissed
    setPassword("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const dek = await unlockDek(password, encryptionMeta);
      setPassword("");
      onUnlocked(dek);
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        setError(t("Incorrect password. Please try again."));
      } else {
        setError(t("Failed to unlock page."));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Unlock page")}
      centered
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
    >
      {pageTitle && (
        <Text mb="md" fw={500}>
          {pageTitle}
        </Text>
      )}
      <Text size="sm" c="dimmed" mb="md">
        {t("Enter the page password to decrypt its content.")}
      </Text>

      <form onSubmit={handleSubmit}>
        <PasswordInput
          label={t("Password")}
          placeholder={t("Enter page password")}
          variant="filled"
          mb="md"
          data-autofocus
          value={password}
          onChange={(event) => {
            setPassword(event.currentTarget.value);
            setError(null);
          }}
          error={error}
          visibilityToggleButtonProps={{
            "aria-label": t("Toggle password visibility"),
            "aria-hidden": false,
            tabIndex: 0,
          }}
        />

        <Group justify="flex-end" mt="md">
          <Button
            type="submit"
            disabled={isLoading || !password}
            loading={isLoading}
          >
            {t("Unlock")}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
