import { ReactNode, useState } from "react";
import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import { usePageQuery } from "@/features/page/queries/page-query";
import { isReaderOfControlledPage } from "@/features/page/page.utils";
import type { IPage } from "@/features/page/types/page.types";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import {
  usePageVerificationInfoQuery,
  useVerifyPageMutation,
  useWithdrawApprovalMutation,
} from "@/ee/page-verification/queries/page-verification-query";
import type { IPageVerificationInfo } from "@/ee/page-verification/types/page-verification.types";
import {
  ApprovalBannerState,
  getApprovalBannerModel,
} from "@/ee/page-verification/utils/approval-state";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { ApprovalCompareModal } from "./approval-compare-modal";
import { RequestChangesModal } from "./request-changes-modal";
import { SubmitApprovalModal } from "./submit-approval-modal";

type ApprovalBannerProps = {
  slugId: string;
};

const BANNER_COLORS = {
  unpublished: "yellow",
  changes: "yellow",
  in_review: "blue",
  obsolete: "gray",
} as const;

export function ApprovalBanner({ slugId }: ApprovalBannerProps) {
  const { data: page } = usePageQuery({ pageId: slugId });
  const reader = isReaderOfControlledPage(page);
  const draftUser =
    page?.approval?.controlled === true && page.approval.canAccessDraft;
  const { data: info } = usePageVerificationInfoQuery(
    !page?.deletedAt && (reader || draftUser) ? page.id : undefined,
  );

  if (!page || page.deletedAt || !info) return null;

  if (reader) {
    return info.status === "obsolete" ? <ObsoleteNotice /> : null;
  }

  return draftUser ? <DraftUserBanner page={page} info={info} /> : null;
}

type BannerFrameProps = {
  color: "yellow" | "blue" | "red" | "gray";
  children: ReactNode;
};

function BannerFrame({ color, children }: BannerFrameProps) {
  return (
    <Paper
      radius="sm"
      mb="md"
      px="md"
      py="xs"
      bg={`var(--mantine-color-${color}-light)`}
      role="status"
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        {children}
      </Group>
    </Paper>
  );
}

function ObsoleteNotice() {
  const { t } = useTranslation();

  return (
    <BannerFrame color="gray">
      <Text size="sm">
        {t("Obsolete. This page is kept for reference and may be out of date.")}
      </Text>
    </BannerFrame>
  );
}

type DraftUserBannerProps = {
  page: IPage;
  info: IPageVerificationInfo;
};

function DraftUserBanner({ page, info }: DraftUserBannerProps) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const hasFeature = useHasFeature(Feature.PAGE_VERIFICATION);
  const verifyMutation = useVerifyPageMutation();
  const withdrawMutation = useWithdrawApprovalMutation();
  const [submitOpened, submit] = useDisclosure(false);
  const [requestOpened, request] = useDisclosure(false);
  const [diff, setDiff] = useState<{
    mode: "review" | "compare";
    opened: boolean;
  }>({ mode: "compare", opened: false });
  const requestedAt = info.pendingSubmission?.requestedAt ?? info.requestedAt;
  const inReviewSince = useTimeAgo(requestedAt ?? undefined);

  const model = getApprovalBannerModel(page.approval, info);
  if (!model) return null;
  const { state, returned } = model;

  const permissions = info.permissions;
  // A space-controlled page without an approval row may come back without permissions.
  const canSubmit =
    hasFeature &&
    (permissions
      ? permissions.canSubmitForApproval
      : !!page.permissions?.canEdit);
  const canReview = hasFeature && !!permissions?.canVerify;
  const canWithdraw = !!permissions?.canWithdraw;

  const handleApprove = () => {
    // Pinned to the submission shown now, not whichever is pending at confirm time.
    const { pendingHistoryId, pendingSubmission } = info;
    modals.openConfirmModal({
      title: t("Approve this version"),
      centered: true,
      children: (
        <Stack gap="xs">
          <Text size="sm">
            {t("Readers will see this version as soon as you approve it.")}
          </Text>
          {pendingSubmission?.changeSummary && (
            <Text
              size="sm"
              c="dimmed"
              fs="italic"
              style={{ whiteSpace: "pre-wrap" }}
            >
              &ldquo;{pendingSubmission.changeSummary}&rdquo;
            </Text>
          )}
        </Stack>
      ),
      labels: { confirm: t("Approve"), cancel: t("Cancel") },
      onConfirm: () =>
        verifyMutation.mutate({ pageId: page.id, pendingHistoryId }),
    });
  };

  const describe = (current: ApprovalBannerState): string => {
    switch (current.kind) {
      case "unpublished":
        return t("Draft. Readers can't see this page until it's approved.");
      case "changes": {
        const { number, approvedAt } = current.version;
        if (number == null) {
          return t(
            "Draft. Readers see the content from before approval was turned on.",
          );
        }
        return approvedAt
          ? t("Draft. Readers see version {{n}} (approved {{date}}).", {
              n: number,
              date: formatLocalized(
                new Date(approvedAt),
                "MMM d, yyyy",
                "PP",
                locale,
              ),
            })
          : t("Draft. Readers see version {{n}}.", { n: number });
      }
      case "in_review":
        return t("In review since {{time}} by {{name}}. Editing is paused.", {
          time: inReviewSince,
          name:
            (info.pendingSubmission?.requestedBy ?? info.requestedBy)?.name ??
            t("Someone"),
        });
      case "obsolete":
        return current.version?.number != null
          ? t("Obsolete. Readers see version {{n}} with an obsolete notice.", {
              n: current.version.number,
            })
          : t(
              "Obsolete. Readers see the last approved version with an obsolete notice.",
            );
    }
  };

  const returnedName = returned?.by?.name ?? t("Someone");

  return (
    <>
      {returned && (
        <BannerFrame color="red">
          <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
            {returned.comment
              ? t("Changes requested by {{name}}: {{comment}}", {
                  name: returnedName,
                  comment: returned.comment,
                })
              : t("Changes requested by {{name}}.", { name: returnedName })}
          </Text>
        </BannerFrame>
      )}

      {state && (
        <BannerFrame color={BANNER_COLORS[state.kind]}>
          <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
            {describe(state)}
          </Text>
          <Group gap="xs" wrap="wrap">
            {state.kind === "changes" && (
              <Button
                size="xs"
                variant="default"
                onClick={() => setDiff({ mode: "compare", opened: true })}
              >
                {t("Compare")}
              </Button>
            )}
            {(state.kind === "unpublished" || state.kind === "changes") &&
              canSubmit && (
                <Button size="xs" color="dark" onClick={submit.open}>
                  {t("Submit for approval")}
                </Button>
              )}
            {state.kind === "in_review" && canReview && (
              <>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => setDiff({ mode: "review", opened: true })}
                >
                  {t("Review")}
                </Button>
                {info.pendingHistoryId && (
                  <Button
                    size="xs"
                    color="dark"
                    onClick={handleApprove}
                    loading={verifyMutation.isPending}
                  >
                    {t("Approve")}
                  </Button>
                )}
                <Button size="xs" variant="default" onClick={request.open}>
                  {t("Request changes")}
                </Button>
              </>
            )}
            {state.kind === "in_review" && canWithdraw && (
              <Button
                size="xs"
                variant="default"
                onClick={() => withdrawMutation.mutate(page.id)}
                loading={withdrawMutation.isPending}
              >
                {t("Withdraw")}
              </Button>
            )}
          </Group>
        </BannerFrame>
      )}

      <SubmitApprovalModal
        pageId={page.id}
        opened={submitOpened}
        onClose={submit.close}
      />
      <ApprovalCompareModal
        pageId={page.id}
        mode={diff.mode}
        opened={diff.opened}
        onClose={() => setDiff((current) => ({ ...current, opened: false }))}
      />
      <RequestChangesModal
        pageId={page.id}
        opened={requestOpened}
        onClose={request.close}
      />
    </>
  );
}
