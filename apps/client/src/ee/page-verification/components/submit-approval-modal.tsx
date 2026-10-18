import { useState } from "react";
import { Button, Group, Modal, Stack, Text, Textarea, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  usePageVerificationInfoQuery,
  useSubmitForApprovalMutation,
} from "@/ee/page-verification/queries/page-verification-query";
import { VerifierList } from "./verifier-list";

// Matches the server limit on change summaries.
const MAX_SUMMARY_LENGTH = 2000;

type SubmitApprovalModalProps = {
  pageId: string;
  opened: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function SubmitApprovalModal({
  pageId,
  opened,
  onClose,
  onSubmitted,
}: SubmitApprovalModalProps) {
  const { t } = useTranslation();
  const { data: info } = usePageVerificationInfoQuery(opened ? pageId : undefined);
  const submitMutation = useSubmitForApprovalMutation();
  const [summary, setSummary] = useState("");

  const approvers = info?.verifiers ?? [];

  const handleClose = () => {
    setSummary("");
    onClose();
  };

  const handleSubmit = () => {
    submitMutation.mutate(
      { pageId, changeSummary: summary.trim() },
      {
        onSuccess: () => {
          setSummary("");
          onClose();
          onSubmitted?.();
        },
      },
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Submit for approval")}
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {t("Editing is paused while your changes are in review.")}
        </Text>

        <Textarea
          label={t("Change summary")}
          placeholder={t("Summarize what changed for the approver...")}
          value={summary}
          onChange={(event) => setSummary(event.currentTarget.value)}
          minRows={3}
          resize="vertical"
          maxLength={MAX_SUMMARY_LENGTH}
          variant="filled"
          required
          data-autofocus
        />

        <div>
          <Title order={3} size="h6" mb={4}>
            {t("Approvers")}
          </Title>
          {approvers.length > 0 && <VerifierList verifiers={approvers} />}
          {info?.spaceRequiresApproval && (
            <Text size="sm" c="dimmed">
              {t("Approvers set for this space are notified as well.")}
            </Text>
          )}
        </div>

        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={handleClose}>
            {t("Cancel")}
          </Button>
          <Button
            color="dark"
            onClick={handleSubmit}
            disabled={!summary.trim()}
            loading={submitMutation.isPending}
          >
            {t("Submit for approval")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
