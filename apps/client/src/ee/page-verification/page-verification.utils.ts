import type { JSONContent } from "@tiptap/react";
import type { TFunction } from "i18next";
import {
  BaselineCopy,
  IPageVerificationInfo,
  ReviewLinkTarget,
  VerificationChangesBaselineKind,
  VerificationType,
} from "@/ee/page-verification/types/page-verification.types";
import { DIAGRAM_NODE_TYPES } from "@/ee/page-verification/page-verification.constants";

export function canReviewChanges(info?: IPageVerificationInfo): boolean {
  if (!info) return false;

  if (info.type === "expiring") {
    return (
      !!info.verifiedHistoryId &&
      (info.status === "invalidated" || info.status === "expired")
    );
  }

  if (info.type === "qms") {
    return (
      (!!info.verifiedHistoryId || !!info.rejectedHistoryId) &&
      (info.status === "draft" || info.status === "in_approval")
    );
  }

  return false;
}

export function getReviewLinkTarget(
  info?: IPageVerificationInfo,
): ReviewLinkTarget {
  if (canReviewChanges(info)) return "review";
  if (info && info.status !== "none") return "verification";
  return "none";
}

// accepts the response or the info pointers, since it only checks which exist
export function getDefaultBaselineKind(baselines?: {
  verified?: unknown;
  rejected?: unknown;
}): VerificationChangesBaselineKind | null {
  if (baselines?.verified) return "verified";
  if (baselines?.rejected) return "rejected";
  return null;
}

export function getBaselineCopy(
  kind: VerificationChangesBaselineKind,
  type: VerificationType | undefined,
  t: TFunction,
): BaselineCopy {
  if (kind === "rejected") {
    return {
      title: t("Changes since rejection"),
      byLine: (values) => t("Returned by {{name}} {{time}}", values),
      matches: t("The current page matches the rejected version."),
    };
  }

  if (type === "qms") {
    return {
      title: t("Changes since approval"),
      byLine: (values) => t("Approved by {{name}} {{time}}", values),
      matches: t("The current page matches the approved version."),
    };
  }

  return {
    title: t("Changes since verification"),
    byLine: (values) => t("Last verified by {{name}} {{time}}", values),
    matches: t("The current page matches the verified version."),
  };
}

export function containsDiagram(doc: JSONContent | null | undefined): boolean {
  if (!doc) return false;
  if (DIAGRAM_NODE_TYPES.has(doc.type)) return true;
  return (doc.content ?? []).some(containsDiagram);
}
