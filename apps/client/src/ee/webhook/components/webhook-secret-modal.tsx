import {
  Alert,
  Button,
  Code,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import CopyTextButton from "@/components/common/copy";

interface WebhookSecretModalProps {
  opened: boolean;
  onClose: () => void;
  secret: string | null;
}

export function WebhookSecretModal({
  opened,
  onClose,
  secret,
}: WebhookSecretModalProps) {
  const { t } = useTranslation();

  if (!secret) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Save this signing secret")}
      size="lg"
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title={t("Important")}
          color="red"
        >
          {t(
            "We won't show it again. Copy it now and store it somewhere safe. You can rotate it later if needed.",
          )}
        </Alert>

        <div>
          <Text size="sm" fw={500} mb="xs">
            {t("Signing secret")}
          </Text>
          <Group gap="xs" wrap="nowrap" align="center">
            <Code
              block
              style={{
                flex: 1,
                wordBreak: "break-all",
                whiteSpace: "pre-wrap",
              }}
            >
              {secret}
            </Code>
            <CopyTextButton text={secret} />
          </Group>
        </div>

        <Text size="sm" c="dimmed">
          {t(
            "Use this secret to verify the X-Docmost-Signature header on incoming webhook deliveries.",
          )}
        </Text>

        <Button fullWidth onClick={onClose} mt="md">
          {t("I've saved my signing secret")}
        </Button>
      </Stack>
    </Modal>
  );
}
