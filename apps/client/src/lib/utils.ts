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
