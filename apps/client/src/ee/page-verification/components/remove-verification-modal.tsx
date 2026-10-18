import { useState } from "react";
import { Button, Group, Modal, Radio, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useRemoveVerificationMutation } from "@/ee/page-verification/queries/page-verification-query";
import type { DraftAction } from "@/ee/page-verification/types/page-verification.types";

type RemoveVerificationFormProps = {
  pageId: string;
  onCancel: () => void;
  onRemoved?: () => void;
  // Changes readers haven't seen need an explicit publish or discard.
  hasDraftChanges?: boolean;
  // A page that was never published has no earlier version to go back to.
  canDiscard?: boolean;
};

export function RemoveVerificationForm({
  pageId,
  onCancel,
  onRemoved,
  hasDraftChanges,
  canDiscard = true,
}: RemoveVerificationFormProps) {
  const { t } = useTranslation();
  const removeMutation = useRemoveVerificationMutation();
  const [chosen, setChosen] = useState<DraftAction | null>(null);
  const draftAction = canDiscard ? chosen : "publish";

  const handleCancel = () => {
    setChosen(null);
    onCancel();
  };

  const handleRemove = () => {
    removeMutation.mutate(
      hasDraftChanges ? { pageId, draftAction } : { pageId },
      {
        onSuccess: () => {
          setChosen(null);
          onRemoved?.();
        },
      },
    );
  };

  return (
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
          onChange={(value) => setChosen(value as DraftAction)}
        >
          <Stack gap="xs" mt="xs">
            <Radio
              value="publish"
              label={t("Publish the changes")}
              description={t("Readers see the current draft.")}
            />
            {canDiscard && (
              <Radio
                value="discard"
                label={t("Discard the changes")}
                description={t(
                  "The page returns to the version readers see now.",
                )}
              />
            )}
          </Stack>
        </Radio.Group>
      )}

      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={handleCancel}>
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
  );
}

type RemoveVerificationModalProps = Omit<
  RemoveVerificationFormProps,
  "onCancel"
> & {
  opened: boolean;
  onClose: () => void;
};

export function RemoveVerificationModal({
  opened,
  onClose,
  onRemoved,
  ...form
}: RemoveVerificationModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Remove verification")}
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      <RemoveVerificationForm
        {...form}
        onCancel={onClose}
        onRemoved={() => {
          onClose();
          onRemoved?.();
        }}
      />
    </Modal>
  );
}
