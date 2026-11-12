import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useReleaseLegalHoldMutation } from "@/ee/legal-hold/queries/legal-hold-query";

type LegalHoldReleaseModalProps = {
  opened: boolean;
  onClose: () => void;
  legalHoldId: string | null;
};

export function LegalHoldReleaseModal({
  opened,
  onClose,
  legalHoldId,
}: LegalHoldReleaseModalProps) {
  const { t } = useTranslation();
  const releaseMutation = useReleaseLegalHoldMutation();

  const handleRelease = async () => {
    if (!legalHoldId) return;
    try {
      await releaseMutation.mutateAsync({ legalHoldId });
      onClose();
    } catch {
      // the mutation shows the error
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Release legal hold")}
      size="md"
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      <Stack gap="md">
        <Text>{t("Are you sure you want to release this legal hold?")}</Text>
        <Text size="sm" c="dimmed">
          {t(
            "Content kept only by this hold will be permanently deleted after 30 days.",
          )}
        </Text>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            color="red"
            onClick={handleRelease}
            loading={releaseMutation.isPending}
          >
            {t("Release")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
