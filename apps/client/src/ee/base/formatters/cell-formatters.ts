import { formatNumber } from "@/ee/base/components/cells/cell-number";
import { formatDateValue, parseDateValue } from "@/ee/base/utils/date-value";

export { formatNumber, formatDateValue, parseDateValue };

export function formatTimestamp(value: string | null | undefined): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLongTextPreview(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}
