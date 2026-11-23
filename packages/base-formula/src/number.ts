import { instantToWall } from "./date";
import { isDateValue } from "./date-value";

const pad2 = (n: number): string => String(n).padStart(2, "0");

export function snapNumber(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Number(n.toPrecision(15));
}

export function valueToString(v: unknown, zone: string): string {
  if (v == null) return "";
  if (typeof v === "number") return String(snapNumber(v));
  if (isDateValue(v)) {
    if (v.kind === "date") return v.value;
    const w = instantToWall(v.value, zone);
    return `${w.ymd} ${pad2(w.hour)}:${pad2(w.minute)}`;
  }
  return String(v);
}
