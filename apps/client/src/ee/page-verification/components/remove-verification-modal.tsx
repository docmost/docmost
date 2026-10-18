import { useState } from "react";
import { Button, Group, Modal, Radio, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useRemoveVerificationMutation } from "@/ee/page-verification/queries/page-verification-query";
import type { DraftAction } from "@/ee/page-verification/types/page-verification.types";

type RemoveVerificationModalProps = {
  pageId: string;
  opened: boolean;
  onClose: () => void;
  // Changes readers haven't seen need an explicit publish or discard.
  hasDraftChanges?: boolean;
  onRemoved?: () => void;
};

export function RemoveVerificationModal({
  pageId,
  opened,
  onClose,
  hasDraftChanges,
  onRemoved,
}: RemoveVerificationModalProps) {
  const { t } = useTranslation();
  const removeMutation = useRemoveVerificationMutation();
  const [draftAction, setDraftAction] = useState<DraftAction | null>(null);

  const handleClose = () => {
    setDraftAction(null);
    onClose();
  };

  const handleRemove = () => {
    removeMutation.mutate(
      hasDraftChanges ? { pageId, draftAction } : { pageId },
      {
        onSuccess: () => {
          handleClose();
          onRemoved?.();
        },
      },
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Remove verification")}
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      <Stack>
        <Text size="sm">
          {t("Are you sure you want to remove verification from this page?")}
        </Text>

        {hasDraftChanges && (
          <Radio.Group
            label={t(
              "This page has changes that readers haven't seen. What should happen to them?",
            )}
            value={draftAction}
            onChange={(value) => setDraftAction(value as DraftAction)}
          >
            <Stack gap="xs" mt="xs">
              <Radio
                value="publish"
                label={t("Publish the changes")}
                description={t("Readers see the current draft.")}
              />
              <Radio
                value="discard"
                label={t("Discard the changes")}
                description={t(
                  "The page returns to the version readers see now.",
                )}
              />
            </Stack>
          </Radio.Group>
        )}

        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={handleClose}>
            {t("Cancel")}
          </Button>
          <Button
            color="red"
            onClick={handleRemove}
            disabled={hasDraftChanges && !draftAction}
            loading={removeMutation.isPending}
          >
            {t("Remove")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
