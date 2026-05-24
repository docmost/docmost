import type { BasePropertyType } from "@/features/base/types/base.types";

export const NON_USER_TARGET_TYPES = new Set<BasePropertyType>([
  "createdAt",
  "lastEditedAt",
  "lastEditedBy",
  "formula",
]);

/*
 * Returns the warning copy shown in the property-menu's
 * `confirmTypeChange` panel before the user applies a type change.
 * Strings are i18n source keys (translation files key them by their
 * exact text). Buckets are ordered most-specific first; the default
 * branch covers safe reinterpretations like text ↔ number, text → url,
 * text → email.
 */
export function conversionWarning(
  from: BasePropertyType,
  to: BasePropertyType,
): string {
  if (to === "text") {
    if (from === "select" || from === "status") {
      return "Cells will be replaced with the option name.";
    }
    if (from === "multiSelect") {
      return "Cells will be replaced with a comma-separated list of option names.";
    }
    if (from === "person") {
      return "Cells will be replaced with the person's name.";
    }
    if (from === "file") {
      return "Cells will be replaced with a comma-separated list of file names.";
    }
    if (from === "page") {
      return "Cells will be replaced with the page title.";
    }
  }

  if (to === "select" && from === "multiSelect") {
    return "Only the first selected item per row will be kept; the rest will be discarded.";
  }

  if (to === "multiSelect" && from === "select") {
    return "Existing values become single-item lists. No data is lost.";
  }

  if (to === "page") {
    return "Cells that aren't already a page reference will be cleared.";
  }

  if (to === "number" && from !== "number") {
    return "Cells that can't be parsed as a number will be cleared.";
  }

  if (to === "date" && from !== "date") {
    return "Cells that can't be parsed as a date will be cleared.";
  }

  if (to === "checkbox" && from !== "checkbox") {
    return "Cells will be coerced (yes/true/1 become checked; everything else becomes unchecked or cleared).";
  }

  if ((to === "url" || to === "email") && from !== to) {
    return to === "url"
      ? "Cells that aren't a valid URL will be cleared."
      : "Cells that aren't a valid email address will be cleared.";
  }

  return "Cells will be reinterpreted under the new type.";
}
