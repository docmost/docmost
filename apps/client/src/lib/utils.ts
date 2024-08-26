export function formatMemberCount(memberCount: number): string {
  if (memberCount === 1) {
    return "1 member";
  } else {
    return `${memberCount} members`;
  }
}

export function extractPageSlugId(input: string): string {
  if (!input) {
    return undefined;
  }
  const parts = input.split("-");
  return parts.length > 1 ? parts[parts.length - 1] : input;
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

export const formatBytes = (
  bytes: number,
  decimalPlaces: number = 2,
): string => {
  if (bytes === 0) return "0.0 KB";

  const unitSize = 1024;
  const precision = decimalPlaces < 0 ? 0 : decimalPlaces;
  const units = ["KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const kilobytes = bytes / unitSize;

  const unitIndex = Math.floor(Math.log(kilobytes) / Math.log(unitSize));
  const adjustedUnitIndex = Math.max(unitIndex, 0);
  const adjustedSize = kilobytes / Math.pow(unitSize, adjustedUnitIndex);

  return `${adjustedSize.toFixed(precision)} ${units[adjustedUnitIndex]}`;
};
