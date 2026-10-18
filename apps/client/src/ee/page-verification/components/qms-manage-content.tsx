import { useEffect, useState } from "react";
import { Button, Checkbox, Divider, Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import {
  useMarkObsoleteMutation,
  useRestoreObsoleteMutation,
  useUpdateVerificationMutation,
  useVerifyPageMutation,
  useWithdrawApprovalMutation,
} from "@/ee/page-verification/queries/page-verification-query";
import type { IPageVerificationInfo } from "@/ee/page-verification/types/page-verification.types";
import {
  hasSubmittableChanges,
  requiresSpaceApproval,
  wasReturned,
} from "@/ee/page-verification/utils/approval-state";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { RemoveVerificationModal } from "./remove-verification-modal";
import { RequestChangesModal } from "./request-changes-modal";
import { SubmitApprovalModal } from "./submit-approval-modal";
import { VerifierList } from "./verifier-list";
import { VerifierPicker } from "./verifier-picker";
import { MAX_VERIFIERS } from "./user-option";

type QmsManageContentProps = {
  pageId: string;
  info: IPageVerificationInfo;
  onClose: () => void;
};

export function QmsManageContent({
  pageId,
  info,
  onClose,
}: QmsManageContentProps) {
  const { t } = useTranslation();
  const verifyMutation = useVerifyPageMutation();
  const withdrawMutation = useWithdrawApprovalMutation();
  const obsoleteMutation = useMarkObsoleteMutation();
  const restoreMutation = useRestoreObsoleteMutation();
  const updateMutation = useUpdateVerificationMutation();
  const [submitOpened, submit] = useDisclosure(false);
  const [requestChangesOpened, requestChanges] = useDisclosure(false);
  const [removeOpened, remove] = useDisclosure(false);
  // The submission the approver ticked "reviewed" for; approving is pinned to it.
  const [reviewedId, setReviewedId] = useState<string | null>(null);
  const verifiedAtAgo = useTimeAgo(info.verifiedAt ?? new Date().toISOString());
  const requestedAtAgo = useTimeAgo(
    info.pendingSubmission?.requestedAt ??
      info.requestedAt ??
      new Date().toISOString(),
  );
  const rejectedAtAgo = useTimeAgo(info.rejectedAt ?? new Date().toISOString());

  const status = info.status;
  const permissions = info.permissions;
  const pendingId = info.pendingHistoryId ?? null;
  const reviewed = reviewedId !== null && reviewedId === pendingId;
  const spaceRequiresApproval = requiresSpaceApproval(info, undefined);
  const existingVerifierIds = info.verifiers?.map((v) => v.id) ?? [];

  // A new or withdrawn submission has not been reviewed yet.
  useEffect(() => {
    setReviewedId(null);
  }, [pendingId]);

  const canVerify = status === "in_approval" && !!permissions?.canVerify;
  const canWithdraw = status === "in_approval" && !!permissions?.canWithdraw;
  const canRestore = status === "obsolete" && !!permissions?.canManage;
  const canMarkObsolete = status === "approved" && !!permissions?.canMarkObsolete;
  // Spaces that require approval keep it on for every page.
  const canRemove = !!permissions?.canRemove && !spaceRequiresApproval;
  const canManageApprovers = !!permissions?.canManage && status !== "obsolete";
  const mayBeSubmitted =
    !!permissions?.canSubmitForApproval &&
    (status === "draft" || status === "approved");
  const canSubmit = mayBeSubmitted && hasSubmittableChanges(info);
  const showApprovers =
    (info.verifiers?.length ?? 0) > 0 ||
    (canManageApprovers && spaceRequiresApproval);

  const handleVerify = () => {
    if (!reviewed) return;
    verifyMutation.mutate(
      { pageId, pendingHistoryId: reviewedId },
      {
        onSuccess: () => {
          setReviewedId(null);
          onClose();
        },
        onError: (error) => {
          if (error["response"]?.status === 409) setReviewedId(null);
        },
      },
    );
  };

  const handleMarkObsolete = () => {
    modals.openConfirmModal({
      title: t("Mark as obsolete"),
      children: (
        <Stack gap="xs">
          <Text size="sm">
            {t("Are you sure you want to mark this page as obsolete?")}
          </Text>
          <Text size="sm" c="dimmed">
            {t(
              "Editing is paused and readers see the last approved version with an obsolete notice. Space admins and approvers can restore the page later.",
            )}
          </Text>
        </Stack>
      ),
      labels: { confirm: t("Mark obsolete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => obsoleteMutation.mutate(pageId, { onSuccess: onClose }),
    });
  };

  const handleRemoveApprover = (userId: string) => {
    if (!info.verifiers) return;
    const remaining = info.verifiers
      .filter((v) => v.id !== userId)
      .map((v) => v.id);
    updateMutation.mutate({ pageId, verifierIds: remaining });
  };

  const handleAddApprover = (userId: string) => {
    const current = info.verifiers ?? [];
    if (current.some((v) => v.id === userId)) return;
    updateMutation.mutate({
      pageId,
      verifierIds: [...current.map((v) => v.id), userId],
    });
  };

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        {t("Pages move through draft, approval, and approved stages.")}
      </Text>

      {status === "draft" &&
        (wasReturned(info) ? (
          <div>
            <Text size="sm" c="red">
              {t("Returned by {{name}} {{time}}", {
                name: info.rejectedBy?.name ?? t("Someone"),
                time: rejectedAtAgo,
              })}
            </Text>
            {info.rejectionComment && (
              <Text size="sm" c="dimmed" mt={4} fs="italic">
                &ldquo;{info.rejectionComment}&rdquo;
              </Text>
            )}
          </div>
        ) : (
          <Text size="sm">{t("No approval has been requested yet.")}</Text>
        ))}

      {status === "in_approval" && (
        <div>
          <Text size="sm">
            {t("Submitted by {{name}} {{time}}", {
              name:
                (info.pendingSubmission?.requestedBy ?? info.requestedBy)
                  ?.name ?? t("Someone"),
              time: requestedAtAgo,
            })}
          </Text>
          {info.pendingSubmission?.changeSummary && (
            <Text
              size="sm"
              c="dimmed"
              mt={4}
              fs="italic"
              style={{ whiteSpace: "pre-wrap" }}
            >
              &ldquo;{info.pendingSubmission.changeSummary}&rdquo;
            </Text>
          )}
        </div>
      )}

      {status === "approved" && info.verifiedBy && (
        <div>
          <Text size="sm">
            {t("Approved by {{name}} {{time}}", {
              name: info.verifiedBy.name,
              time: verifiedAtAgo,
            })}
          </Text>
        </div>
      )}

      {status === "approved" && info.hasDraftChanges === true && (
        <Text size="sm" c="dimmed">
          {t("This page has draft changes that readers can't see until they are approved.")}
        </Text>
      )}

      {status === "obsolete" && (
        <Text size="sm" c="dimmed">
          {t("This document has been marked as obsolete.")}
        </Text>
      )}

      {mayBeSubmitted && !canSubmit && (
        <Text size="sm" c="dimmed">
          {t("No changes to submit")}
        </Text>
      )}

      <Divider />

      {showApprovers && (
        <>
          <div>
            <Text size="sm" fw={600} tt="uppercase" c="dimmed" mb={4}>
              {t("Approvers")}
            </Text>
            {spaceRequiresApproval && (
              <Text size="xs" c="dimmed" mb="xs">
                {t("Approvers set for this space always apply to this page.")}
              </Text>
            )}
            <VerifierList
              verifiers={info.verifiers ?? []}
              canManage={canManageApprovers}
              onRemove={canManageApprovers ? handleRemoveApprover : undefined}
            />
            {canManageApprovers &&
              (info.verifiers?.length ?? 0) < MAX_VERIFIERS && (
                <div style={{ marginTop: "var(--mantine-spacing-xs)" }}>
                  <VerifierPicker
                    excludeIds={existingVerifierIds}
                    onSelect={(user) => handleAddApprover(user.value)}
                    placeholder={t("Add approver")}
                  />
                </div>
              )}
          </div>
          <Divider />
        </>
      )}

      {canVerify && (
        <div>
          <Checkbox
            label={t("I've reviewed this page for accuracy")}
            checked={reviewed}
            disabled={!pendingId}
            onChange={(event) =>
              setReviewedId(event.currentTarget.checked ? pendingId : null)
            }
            color="dark"
          />
        </div>
      )}

      <Group justify="space-between">
        {canRemove && (
          <Button
            variant="subtle"
            color="red"
            size="compact-sm"
            onClick={remove.open}
          >
            {t("Remove verification")}
          </Button>
        )}

        <Group gap="xs" ml="auto">
          {canSubmit && (
            <Button color="dark" onClick={submit.open}>
              {t("Submit for approval")}
            </Button>
          )}

          {canWithdraw && (
            <Button
              variant="default"
              onClick={() => withdrawMutation.mutate(pageId, { onSuccess: onClose })}
              loading={withdrawMutation.isPending}
            >
              {t("Withdraw")}
            </Button>
          )}

          {canVerify && (
            <>
              <Button
                variant="light"
                color="red"
                onClick={requestChanges.open}
              >
                {t("Request changes")}
              </Button>
              <Button
                color="dark"
                onClick={handleVerify}
                disabled={!reviewed}
                loading={verifyMutation.isPending}
              >
                {t("Approve")}
              </Button>
            </>
          )}

          {canMarkObsolete && (
            <Button
              variant="light"
              color="gray"
              onClick={handleMarkObsolete}
              loading={obsoleteMutation.isPending}
            >
              {t("Mark obsolete")}
            </Button>
          )}

          {canRestore && (
            <Button
              variant="light"
              onClick={() => restoreMutation.mutate(pageId, { onSuccess: onClose })}
              loading={restoreMutation.isPending}
            >
              {t("Restore from obsolete")}
            </Button>
          )}
        </Group>
      </Group>

      <SubmitApprovalModal
        pageId={pageId}
        opened={submitOpened}
        onClose={submit.close}
        onSubmitted={onClose}
      />
      <RequestChangesModal
        pageId={pageId}
        opened={requestChangesOpened}
        onClose={requestChanges.close}
        onDone={onClose}
      />
      <RemoveVerificationModal
        pageId={pageId}
        opened={removeOpened}
        onClose={remove.close}
        hasDraftChanges={info.hasDraftChanges === true}
        onRemoved={onClose}
      />
    </Stack>
  );
}
