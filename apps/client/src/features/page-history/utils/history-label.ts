import type { TFunction } from "i18next";
import { IPageHistory } from "@/features/page-history/types/page.types";

type LabelledHistory = Pick<
  IPageHistory,
  "kind" | "version" | "changeSummary" | "approvedBy"
>;

/**
 * Heading for history rows that belong to the approval workflow. Regular rows
 * and plain draft snapshots have none and keep showing only their date.
 */
export function getHistoryLabel(
  item: LabelledHistory,
  t: TFunction,
): string | null {
  switch (item.kind) {
    case "approved":
      if (item.version == null) return t("Approved");
      return item.approvedBy
        ? t("Version {{n}} · Approved by {{name}}", {
            n: item.version,
            name: item.approvedBy.name,
          })
        : t("Version {{n}} · Approved", { n: item.version });
    case "baseline":
      return t("Baseline");
    case "draft":
      // Only submissions carry a change summary.
      return item.changeSummary ? t("Submitted for approval") : null;
    default:
      return null;
  }
}
