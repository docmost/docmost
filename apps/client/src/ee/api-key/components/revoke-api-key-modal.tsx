import { Modal, Text, Button, Group, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useRevokeApiKeyMutation } from "@/ee/api-key/queries/api-key-query.ts";
import { IApiKey } from "@/ee/api-key";

interface RevokeApiKeyModalProps {
  opened: boolean;
  onClose: () => void;
  apiKey: IApiKey | null;
}

export function RevokeApiKeyModal({
  opened,
  onClose,
  apiKey,
}: RevokeApiKeyModalProps) {
  const { t } = useTranslation();
  const revokeApiKeyMutation = useRevokeApiKeyMutation();

  const handleRevoke = async () => {
    if (!apiKey) return;
    await revokeApiKeyMutation.mutateAsync({
      apiKeyId: apiKey.id,
    });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Revoke API key")}
      size="md"
    >
      <Stack gap="md">
        <Text>
          {t("Are you sure you want to revoke this API key")}{" "}
          <strong>{apiKey?.name}</strong>?
        </Text>
        <Text size="sm" c="dimmed">
          {t(
            "This action cannot be undone. Any applications using this API key will stop working.",
          )}
        </Text>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            color="red"
            onClick={handleRevoke}
            loading={revokeApiKeyMutation.isPending}
          >
            {t("Revoke")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
