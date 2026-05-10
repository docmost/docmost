export function normalizeLabelName(name: string): string {
  return name.trim().replace(/\s+/g, "-").toLowerCase();
}
