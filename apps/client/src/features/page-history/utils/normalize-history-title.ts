// same whitespace rule as the server's title comparison
export function normalizeHistoryTitle(
  title: string | null | undefined,
): string {
  return (title ?? "").replace(/\s+/g, " ").trim();
}
