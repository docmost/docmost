import { UserRole } from "@/lib/types.ts";

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
