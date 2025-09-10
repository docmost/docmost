import React from "react";
import {
  TextInput,
  Button,
  Stack,
  Text,
  Alert,
} from "@mantine/core";
import { IconKey, IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface MfaBackupCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MfaBackupCodeInput({
  value,
  onChange,
  error,
  onSubmit,
  onCancel,
  isLoading,
}: MfaBackupCodeInputProps) {
  const { t } = useTranslation();

  return (
    <Stack>
      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
        <Text size="sm">
          {t(
            "Enter one of your backup codes. Each backup code can only be used once.",
          )}
        </Text>
      </Alert>

      <TextInput
        label={t("Backup code")}
        placeholder="XXXXXXXX"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value.toUpperCase())}
        error={error}
        autoFocus
        data-autofocus
        maxLength={8}
        styles={{
          input: {
            fontFamily: "monospace",
            letterSpacing: "0.1em",
            fontSize: "1rem",
          },
        }}
      />

      <Stack>
        <Button
          fullWidth
          size="md"
          loading={isLoading}
          onClick={onSubmit}
          leftSection={<IconKey size={18} />}
        >
          {t("Verify backup code")}
        </Button>

        <Button
          fullWidth
          variant="subtle"
          color="gray"
          onClick={onCancel}
          disabled={isLoading}
        >
          {t("Use authenticator app instead")}
        </Button>
      </Stack>
    </Stack>
  );
}