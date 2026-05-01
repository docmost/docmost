import { Modal, Text, Button, Group, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useRevokeScimTokenMutation } from "@/ee/scim/queries/scim-token-query";
import { IScimToken } from "@/ee/scim/types/scim-token.types";

interface RevokeScimTokenModalProps {
  opened: boolean;
  onClose: () => void;
  scimToken: IScimToken | null;
}

export function RevokeScimTokenModal({
  opened,
  onClose,
  scimToken,
}: RevokeScimTokenModalProps) {
  const { t } = useTranslation();
  const revokeMutation = useRevokeScimTokenMutation();

  const handleRevoke = async () => {
    if (!scimToken) return;
    await revokeMutation.mutateAsync({ tokenId: scimToken.id });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Revoke {{credential}}", { credential: t("SCIM token") })}
      size="md"
    >
      <Stack gap="md">
        <Text>
          {t("Are you sure you want to revoke this {{credential}}", {
            credential: t("SCIM token"),
          })}{" "}
          <strong>{scimToken?.name}</strong>?
        </Text>
        <Text size="sm" c="dimmed">
          {t(
            "This action cannot be undone. Your identity provider will stop syncing immediately.",
          )}
        </Text>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            color="red"
            onClick={handleRevoke}
            loading={revokeMutation.isPending}
          >
            {t("Revoke")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
