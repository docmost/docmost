import { validate as isValidUUID } from "uuid";
import { ActionIcon } from "@mantine/core";
import { IconFileDescription } from "@tabler/icons-react";
import { ReactNode } from "react";
import { TFunction } from "i18next";

export function formatMemberCount(memberCount: number, t: TFunction): string {
  if (memberCount === 1) {
    return `1 ${t("member")}`;
  } else {
    return `${memberCount} ${t("members")}`;
  }
}

export function extractPageSlugId(slug: string): string {
  if (!slug) {
    return undefined;
  }
  if (isValidUUID(slug)) {
    return slug;
  }
  const parts = slug.split("-");
  return parts.length > 1 ? parts[parts.length - 1] : slug;
}

export const computeSpaceSlug = (name: string) => {
  const alphanumericName = name.replace(/[^a-zA-Z0-9\s]/g, "");
  if (alphanumericName.includes(" ")) {
    return alphanumericName
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  } else {
    return alphanumericName.toLowerCase();
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0.0 KB";

  const unitSize = 1024;
  const units = ["KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const kilobytes = bytes / unitSize;

  const unitIndex = Math.floor(Math.log(kilobytes) / Math.log(unitSize));
  const adjustedUnitIndex = Math.max(unitIndex, 0);
  const adjustedSize = kilobytes / Math.pow(unitSize, adjustedUnitIndex);

  // Use one decimal for KB and no decimals for MB or higher
  const precision = adjustedUnitIndex === 0 ? 1 : 0;

  return `${adjustedSize.toFixed(precision)} ${units[adjustedUnitIndex]}`;
};

export async function svgStringToFile(
  svgString: string,
  fileName: string,
): Promise<File> {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  return new File([blob], fileName, { type: "image/svg+xml" });
}

// Convert a string holding Base64 encoded UTF-8 data into a proper UTF-8 encoded string
// as a replacement for `atob`.
// based on: https://developer.mozilla.org/en-US/docs/Glossary/Base64
function decodeBase64(base64: string): string {
  // convert string to bytes
  const bytes = Uint8Array.from(atob(base64), (m) => m.codePointAt(0));
  // properly decode bytes to UTF-8 encoded string
  return new TextDecoder().decode(bytes);
}

export function decodeBase64ToSvgString(base64Data: string): string {
  const base64Prefix = "data:image/svg+xml;base64,";
  if (base64Data.startsWith(base64Prefix)) {
    base64Data = base64Data.replace(base64Prefix, "");
  }

  return decodeBase64(base64Data);
}

export function capitalizeFirstChar(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function getPageIcon(icon: string, size = 18): string | ReactNode {
  return (
    icon || (
      <ActionIcon variant="transparent" color="gray" size={size}>
        <IconFileDescription size={size} />
      </ActionIcon>
    )
  );
}

export function castToBoolean(value: unknown): boolean {
  if (value == null) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    const trueValues = ["true", "1"];
    const falseValues = ["false", "0"];

    if (trueValues.includes(trimmed)) {
      return true;
    }
    if (falseValues.includes(trimmed)) {
      return false;
    }
    return Boolean(trimmed);
  }

  return Boolean(value);
}
