import { formatNumber } from "@/ee/base/components/cells/cell-number";
export { formatNumber };

export function formatLongTextPreview(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}
