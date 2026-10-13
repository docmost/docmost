import { formatNumber } from "@/ee/base/components/cells/cell-number";
import { formatDateDisplay } from "@/ee/base/components/cells/cell-date";

export { formatNumber, formatDateDisplay };

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
