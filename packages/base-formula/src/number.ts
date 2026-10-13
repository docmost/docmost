export function snapNumber(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Number(n.toPrecision(15));
}

export function valueToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(snapNumber(v));
  return String(v);
}
