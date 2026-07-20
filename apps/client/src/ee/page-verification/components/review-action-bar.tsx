import { useState } from "react";
import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useApproveReviewMutation,
  useRejectReviewMutation,
  useRequestClarificationMutation,
} from "@/ee/page-verification/queries/page-verification-query";
import { IReviewDecisionEntry } from "@/ee/page-verification/types/page-verification.types";

type ReviewActionBarProps = {
  pageId: string;
  unresolvedCommentCount: number;
  myReview: IReviewDecisionEntry | undefined;
};

export function ReviewActionBar({
  pageId,
  unresolvedCommentCount,
  myReview,
}: ReviewActionBarProps) {
  const { t } = useTranslation();
  const approveMutation = useApproveReviewMutation();
  const rejectMutation = useRejectReviewMutation();
  const clarifyMutation = useRequestClarificationMutation();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  if (myReview && myReview.decision !== "pending") {
    return (
      <Text size="sm" c="dimmed">
        {t("You already responded to this review.")}
      </Text>
    );
  }

  const canApproveReject = unresolvedCommentCount === 0;
  const canClarify = unresolvedCommentCount > 0;

  return (
    <>
      <Group>
        <Button
          color="red"
          variant="light"
          disabled={!canApproveReject}
          onClick={() => setRejectOpen(true)}
        >
          {t("Reject")}
        </Button>
        <Button
          color="dark"
          disabled={!canApproveReject}
          loading={approveMutation.isPending}
          onClick={() => approveMutation.mutate(pageId)}
        >
          {t("Approve")}
        </Button>
        <Button
          variant="outline"
          disabled={!canClarify}
          loading={clarifyMutation.isPending}
          onClick={() => clarifyMutation.mutate(pageId)}
        >
          {t("Need Clarify")}
        </Button>
      </Group>

      <Modal
        opened={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={t("Reject page")}
      >
        <Stack>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
            placeholder={t("Reason for rejecting...")}
            minRows={3}
            required
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setRejectOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              color="red"
              disabled={!comment.trim()}
              loading={rejectMutation.isPending}
              onClick={() =>
                rejectMutation.mutate(
                  { pageId, comment },
                  { onSuccess: () => setRejectOpen(false) },
                )
              }
            >
              {t("Confirm rejection")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
