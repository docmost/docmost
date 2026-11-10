import { VerificationStatus } from "@/ee/page-verification/types/page-verification.types";

const STATUS_COLORS: Record<VerificationStatus, string> = {
  verified: "blue",
  approved: "blue",
  expiring: "orange",
  invalidated: "orange",
  in_approval: "orange",
  expired: "red",
  obsolete: "red",
  draft: "gray",
  none: "gray",
};

const TEXT_SHADES: Record<string, number> = {
  blue: 7,
  orange: 8,
  red: 7,
  gray: 6,
};

export function getStatusBadgeColor(status: VerificationStatus): string {
  return STATUS_COLORS[status] ?? "gray";
}

export function getStatusColor(status: VerificationStatus): string {
  const color = getStatusBadgeColor(status);
  return `${color}.${TEXT_SHADES[color]}`;
}

export function getStatusCssColor(status: VerificationStatus): string {
  return `var(--mantine-color-${getStatusColor(status).replace(".", "-")})`;
}

export function getStatusLabel(
  status: VerificationStatus,
  t: (key: string) => string,
): string {
  switch (status) {
    case "verified":
      return t("Verified");
    case "expiring":
      return t("Review needed");
    case "expired":
      return t("Verification expired");
    case "invalidated":
      return t("Unverified changes");
    case "draft":
      return t("Draft");
    case "in_approval":
      return t("In approval");
    case "approved":
      return t("Approved");
    case "obsolete":
      return t("Obsolete");
    default:
      return "";
  }
}
