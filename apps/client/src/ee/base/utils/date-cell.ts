import {
  INVALID_DATE,
  instantToYmd,
  isYmd,
  legacyDateCell,
  normalizeDateCell,
  partKind,
  type DateCell,
  type DateKind,
} from "@docmost/base-formula/client";

export const MIN_PICKER_DATE = "0100-01-01";
export const MAX_PICKER_DATE = "9999-12-31";

export function readDateCell(value: unknown, kind: DateKind): DateCell | null {
  if (typeof value === "string") return legacyDateCell(value, kind);
  const cell = normalizeDateCell(value, kind);
  return cell === INVALID_DATE ? null : cell;
}

export function dateCellsEqual(a: DateCell | null, b: DateCell | null): boolean {
  if (!a || !b) return !a && !b;
  return a.start === b.start && (a.end ?? null) === (b.end ?? null);
}

export function partDayIn(part: string, timeZone: string): string | null {
  if (partKind(part) === "date") return part;
  if (partKind(part) !== "datetime") return null;
  try {
    const day = instantToYmd(part, timeZone);
    return isYmd(day) ? day : null;
  } catch {
    return null;
  }
}
