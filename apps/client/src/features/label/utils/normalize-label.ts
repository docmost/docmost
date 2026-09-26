export function normalizeLabelName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, "-").toLowerCase();
}
