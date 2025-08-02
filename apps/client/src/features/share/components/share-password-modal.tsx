import {
  Modal,
  Text,
  PasswordInput,
  Button,
  Group,
  Alert,
  Stack,
} from "@mantine/core";
import { IconLock, IconAlertCircle } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface SharePasswordModalProps {
  shareId: string;
  opened: boolean;
  onSuccess: (password: string) => void;
}

export default function SharePasswordModal({
  shareId,
  opened,
  onSuccess,
}: SharePasswordModalProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password.trim()) {
      setError(t("Password is required"));
      return;
    }

    setIsLoading(true);
    try {
      setPassword("");
      setError(null);
      onSuccess(password.trim());
    } catch (err) {
      setError(t("Failed to validate password"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      title={
      <Group gap="xs">
        <IconLock size={20} />
        <Text fw={500}>{t("Password Required")}</Text>
      </Group>
      }
      centered
      size="sm"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {t("This page is password protected. Please enter the password to continue.")}
        </Text>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <PasswordInput
          label={t("Password")}
          placeholder={t("Enter password")}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          onKeyDown={handleKeyPress}
          error={error ? true : false}
          data-autofocus
        />

        <Group justify="flex-end">
          <Button
            onClick={handleSubmit}
            loading={isLoading}
            disabled={!password.trim()}
          >
            {t("Continue")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
