import { z } from "zod/v4";
import { formatBytes } from "@/lib";
import type {
  LegalHoldExportStatus,
  LegalHoldStatus,
  PreservationReason,
  PreservedItemType,
} from "./types/legal-hold.types";

type StatusBadge = { label: string; color: string };

export const LEGAL_HOLD_NAME_MAX_LENGTH = 100;

export const LEGAL_HOLD_DESCRIPTION_MAX_LENGTH = 2000;

export const legalHoldFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(LEGAL_HOLD_NAME_MAX_LENGTH),
    description: z.string().max(LEGAL_HOLD_DESCRIPTION_MAX_LENGTH),
    userIds: z.array(z.string()),
    spaceIds: z.array(z.string()),
  })
  .refine((values) => values.userIds.length + values.spaceIds.length > 0, {
    message: "Add at least one custodian or space",
    path: ["userIds"],
  });

export type LegalHoldFormValues = z.infer<typeof legalHoldFormSchema>;

export const LEGAL_HOLD_STATUS_BADGES: Record<LegalHoldStatus, StatusBadge> = {
  active: { label: "Active", color: "green" },
  released: { label: "Released", color: "gray" },
};

export const EXPORT_STATUS_BADGES: Record<LegalHoldExportStatus, StatusBadge> =
  {
    processing: { label: "Processing", color: "blue" },
    success: { label: "Ready", color: "green" },
    failed: { label: "Failed", color: "red" },
    expired: { label: "Expired", color: "gray" },
  };

export const PRESERVATION_REASON_BADGES: Record<
  PreservationReason,
  StatusBadge
> = {
  deleted: { label: "Deleted", color: "red" },
  edited: { label: "Edited", color: "blue" },
};

export const PRESERVED_ITEM_TYPE_LABELS: Record<PreservedItemType, string> = {
  page: "Page",
  page_history: "Page version",
  comment: "Comment",
  attachment: "File",
  base_row: "Base row",
  base_property: "Base property",
  ai_chat: "AI chat",
  user: "Member",
  space: "Space",
};

// int8 columns can reach the client as strings
export function formatFileSize(bytes: number | null): string | null {
  return bytes === null || bytes === undefined
    ? null
    : formatBytes(Number(bytes));
}
