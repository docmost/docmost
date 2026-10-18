import type { TFunction } from "i18next";
import type { IPageApproval } from "@/features/page/types/page.types";
import type {
  ILatestReaderVersion,
  IPageVerificationInfo,
  IUserRef,
  VerificationStatus,
} from "@/ee/page-verification/types/page-verification.types";

// A controlled page without an approval row is controlled by its space and starts as a draft.
export function getApprovalStatus(
  info: IPageVerificationInfo | undefined,
  approval: IPageApproval | undefined,
): VerificationStatus {
  const status = info?.status ?? "none";
  return status === "none" && approval?.controlled ? "draft" : status;
}

export function requiresSpaceApproval(
  info: IPageVerificationInfo | undefined,
  approval: IPageApproval | undefined,
): boolean {
  if (typeof info?.spaceRequiresApproval === "boolean") {
    return info.spaceRequiresApproval;
  }
  // Without an approval row only the space can control a page.
  return approval?.controlled === true && (info?.status ?? "none") === "none";
}

// A page without a reader version has nothing to compare with, so it can always be submitted.
export function hasSubmittableChanges(info: IPageVerificationInfo): boolean {
  return !info.latestReaderVersion || info.hasDraftChanges !== false;
}

export type ApprovalBannerState =
  | { kind: "unpublished" }
  | { kind: "changes"; version: ILatestReaderVersion }
  | { kind: "in_review" }
  | { kind: "obsolete"; version: ILatestReaderVersion | null };

export type ApprovalBannerModel = {
  // Shown above the draft banner after an approver sent the submission back.
  returned: { by: IUserRef | null; comment: string | null } | null;
  state: ApprovalBannerState | null;
};

// The last rejection still stands until a newer submission replaces it.
export function wasReturned(info: IPageVerificationInfo): boolean {
  if (!info.rejectedAt) return false;
  return (
    !info.requestedAt ||
    new Date(info.rejectedAt).getTime() >= new Date(info.requestedAt).getTime()
  );
}

function getBannerState(
  status: VerificationStatus,
  approval: IPageApproval,
  info: IPageVerificationInfo,
): ApprovalBannerState | null {
  const version = info.latestReaderVersion ?? null;

  if (status === "in_approval") return { kind: "in_review" };
  if (status === "obsolete") return { kind: "obsolete", version };
  if (approval.unpublished && !version) return { kind: "unpublished" };
  if (version && info.hasDraftChanges === true) {
    return { kind: "changes", version };
  }
  return null;
}

/**
 * What the approval banner shows to a user with draft access, or null when the
 * page is uncontrolled, the user is a reader, or there is nothing to say.
 */
export function getApprovalBannerModel(
  approval: IPageApproval | undefined,
  info: IPageVerificationInfo | undefined,
): ApprovalBannerModel | null {
  if (!approval?.controlled || !approval.canAccessDraft || !info) return null;

  const status = getApprovalStatus(info, approval);
  const returned =
    status === "draft" && wasReturned(info)
      ? { by: info.rejectedBy ?? null, comment: info.rejectionComment || null }
      : null;
  const state = getBannerState(status, approval, info);

  return state || returned ? { returned, state } : null;
}

export function getReaderBadgeLabel(
  info: Pick<IPageVerificationInfo, "status" | "readerVersion">,
  t: TFunction,
): string {
  switch (info.status) {
    case "approved": {
      const n = info.readerVersion?.number;
      return n == null ? t("Approved") : t("Approved · v{{n}}", { n });
    }
    case "obsolete":
      return t("Obsolete");
    case "not_approved":
      return t("Not yet approved");
    default:
      return "";
  }
}
