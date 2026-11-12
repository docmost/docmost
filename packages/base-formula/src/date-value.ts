import {
  instantToYmd,
  isCanonicalInstant,
  isYmd,
  startOfDay,
  toCanonicalInstant,
} from "./date";
import { makeErrorCell } from "./error";
import type { DateValue, FormulaResultType, Value } from "./types";

export function isDateValue(v: unknown): v is DateValue {
  return typeof v === "object" && v !== null && "kind" in v;
}

export function parseDateText(text: string): DateValue | null {
  if (isYmd(text)) return { kind: "date", value: text };
  const instant = toCanonicalInstant(text);
  return instant === null ? null : { kind: "datetime", value: instant };
}

export function asDateValue(v: Value): DateValue | null {
  if (isDateValue(v)) return v;
  return typeof v === "string" ? parseDateText(v) : null;
}

export function dayOf(d: DateValue, zone: string): string {
  return d.kind === "date" ? d.value : instantToYmd(d.value, zone);
}

export function instantOf(d: DateValue, zone: string): string {
  return d.kind === "datetime" ? d.value : startOfDay(d.value, zone);
}

export function coerceToResultType(
  v: Value,
  resultType: FormulaResultType,
  zone: string,
): Value {
  if (!isDateValue(v) || v.kind === resultType) return v;
  if (resultType !== "datetime" && resultType !== "date") return v;
  try {
    const value = resultType === "datetime" ? instantOf(v, zone) : dayOf(v, zone);
    const canonical = resultType === "datetime" ? isCanonicalInstant(value) : isYmd(value);
    if (canonical) return { kind: resultType, value };
  } catch {
    // falls through to the same cell as a result out of range
  }
  return makeErrorCell("DATE_INVALID", "date out of range");
}
