import type { JSONContent } from "@tiptap/react";
import { IPageVerificationInfo } from "@/ee/page-verification/types/page-verification.types";
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

export function containsDiagram(doc: JSONContent | null | undefined): boolean {
  if (!doc) return false;
  if (DIAGRAM_NODE_TYPES.has(doc.type)) return true;
  return (doc.content ?? []).some(containsDiagram);
}

// same whitespace rule as the server's title comparison
export function normalizeReviewTitle(title: string | null | undefined): string {
  return (title ?? "").replace(/\s+/g, " ").trim();
}
