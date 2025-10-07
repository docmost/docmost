import {
  Modal,
  Text,
  Stack,
  Alert,
  Group,
  Button,
  TextInput,
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IApiKey } from "@/ee/api-key";
import CopyTextButton from "@/components/common/copy.tsx";

interface ApiKeyCreatedModalProps {
  opened: boolean;
  onClose: () => void;
  apiKey: IApiKey;
}

export function ApiKeyCreatedModal({
  opened,
  onClose,
  apiKey,
}: ApiKeyCreatedModalProps) {
  const { t } = useTranslation();

  if (!apiKey) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("API key created")}
      size="lg"
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title={t("Important")}
          color="red"
        >
          {t(
            "Make sure to copy your API key now. You won't be able to see it again!",
          )}
        </Alert>

        <div>
          <Text size="sm" fw={500} mb="xs">
            {t("API key")}
          </Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              variant="filled"
              style={{
                flex: 1,
              }}
              value={apiKey.token}
              readOnly
            />

            <CopyTextButton text={apiKey.token} />
          </Group>
        </div>

        <Button fullWidth onClick={onClose} mt="md">
          {t("I've saved my API key")}
        </Button>
      </Stack>
    </Modal>
  );
}
