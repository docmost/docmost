import type { BasePropertyType } from "@/ee/base/types/base.types";

export const NON_USER_TARGET_TYPES = new Set<BasePropertyType>([
  "createdAt",
  "lastEditedAt",
  "lastEditedBy",
  "formula",
]);

type ConversionInfo = {
  // i18n source key (translation files key them by their exact text).
  message: string;
  // True when cells can be cleared, discarded, truncated, or have their
  // structured value flattened, i.e. the change is not safely reversible.
  // Drives the destructive (red) "Apply" button in the confirm panel.
  lossy: boolean;
};

// Buckets ordered most-specific first; default covers safe reinterpretations.
function describeConversion(
  from: BasePropertyType,
  to: BasePropertyType,
): ConversionInfo {
  if (to === "text" || to === "longText") {
    if (from === "longText" && to === "text") {
      return {
        message:
          "Cells longer than the Text limit will be truncated and the extra content permanently lost.",
        lossy: true,
      };
    }
    if (from === "select" || from === "status") {
      return { message: "Cells will be replaced with the option name.", lossy: true };
    }
    if (from === "multiSelect") {
      return {
        message:
          "Cells will be replaced with a comma-separated list of option names.",
        lossy: true,
      };
    }
    if (from === "person") {
      return { message: "Cells will be replaced with the person's name.", lossy: true };
    }
    if (from === "file") {
      return {
        message:
          "Cells will be replaced with a comma-separated list of file names.",
        lossy: true,
      };
    }
    if (from === "page") {
      return { message: "Cells will be replaced with the page title.", lossy: true };
    }
  }

  if (to === "select" && from === "multiSelect") {
    return {
      message:
        "Only the first selected item per row will be kept; the rest will be discarded.",
      lossy: true,
    };
  }

  if (to === "multiSelect" && from === "select") {
    return {
      message: "Existing values become single-item lists. No data is lost.",
      lossy: false,
    };
  }

  if (to === "page") {
    return {
      message: "Cells that aren't already a page reference will be cleared.",
      lossy: true,
    };
  }

  if (to === "number" && from !== "number") {
    return {
      message: "Cells that can't be parsed as a number will be cleared.",
      lossy: true,
    };
  }

  if (to === "date" && from !== "date") {
    return {
      message: "Cells that can't be parsed as a date will be cleared.",
      lossy: true,
    };
  }

  if (to === "checkbox" && from !== "checkbox") {
    return {
      message:
        "Cells will be coerced (yes/true/1 become checked; everything else becomes unchecked or cleared).",
      lossy: true,
    };
  }

  if ((to === "url" || to === "email") && from !== to) {
    return {
      message:
        to === "url"
          ? "Cells that aren't a valid URL will be cleared."
          : "Cells that aren't a valid email address will be cleared.",
      lossy: true,
    };
  }

  return { message: "Cells will be reinterpreted under the new type.", lossy: false };
}

export function conversionWarning(
  from: BasePropertyType,
  to: BasePropertyType,
): string {
  return describeConversion(from, to).message;
}

// Whether the type change can lose data, used to make "Apply" destructive.
export function isLossyConversion(
  from: BasePropertyType,
  to: BasePropertyType,
): boolean {
  return describeConversion(from, to).lossy;
}
