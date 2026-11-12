import { instantToYmd, isYmd, startOfDay, toCanonicalInstant } from "./date";
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
  if (resultType === "datetime") return { kind: "datetime", value: instantOf(v, zone) };
  if (resultType === "date") return { kind: "date", value: dayOf(v, zone) };
  return v;
}
