import { register } from "./registry";
import { makeErrorCell } from "../error";
import { valueToString } from "../number";
import { asDateValue, dayOf, instantOf, isDateValue, parseDateText } from "../date-value";
import {
  addDays, addMonths, addToInstant, addYears, diffDays, instantToWall, isCanonicalInstant, isYmd,
  startOfDay, todayIn, weekday,
} from "../date";
import type { FormulaAST } from "../ast";
import type { DateValue, ErrorCell, EvalContext, FormulaResultType, Value } from "../types";
import type { DateKind, WallClock } from "../date";

const dateArg = (v: Value): DateValue | ErrorCell =>
  asDateValue(v) ?? makeErrorCell("DATE_INVALID", "invalid date");

const staticDateKind = (
  type: FormulaResultType,
  node: FormulaAST | undefined,
): DateKind | null => {
  if (type === "date" || type === "datetime") return type;
  return node?.t === "str" ? (parseDateText(node.v)?.kind ?? null) : null;
};

type DateUnit = "days" | "weeks" | "months" | "years" | "hours" | "minutes";

const MAX_DATE_AMOUNT = 5_300_000_000;

const UNITS = new Map<string, DateUnit>([
  ["day", "days"], ["days", "days"],
  ["week", "weeks"], ["weeks", "weeks"],
  ["month", "months"], ["months", "months"],
  ["year", "years"], ["years", "years"],
  ["hour", "hours"], ["hours", "hours"],
  ["minute", "minutes"], ["minutes", "minutes"],
]);

const unitOf = (v: Value): DateUnit | null => UNITS.get(String(v).toLowerCase()) ?? null;

const unknownUnit = (unit: Value): ErrorCell =>
  makeErrorCell("TYPE_MISMATCH", `unknown unit ${String(unit).slice(0, 32)}`);

const shift = (args: Value[], sign: 1 | -1, ctx: EvalContext): Value => {
  const [base, amount, unitArg] = args;
  const d = dateArg(base);
  if (!isDateValue(d)) return d;
  const unit = unitOf(unitArg);
  if (unit === null) return unknownUnit(unitArg);
  const raw = Number(amount);
  if (!Number.isFinite(raw)) return makeErrorCell("TYPE_MISMATCH", "invalid amount");
  const n = sign * Math.trunc(raw) + 0;
  const outOfRange = makeErrorCell("DATE_INVALID", "date out of range");
  if (Math.abs(n) > MAX_DATE_AMOUNT) return outOfRange;
  try {
    const clock = unit === "hours" || unit === "minutes";
    let result: DateValue;
    if (d.kind === "date" && !clock) {
      const value =
        unit === "days" ? addDays(d.value, n)
        : unit === "weeks" ? addDays(d.value, 7 * n)
        : unit === "months" ? addMonths(d.value, n)
        : addYears(d.value, n);
      result = { kind: "date", value };
    } else {
      const start = d.kind === "date" ? startOfDay(d.value, ctx.zone) : d.value;
      result = { kind: "datetime", value: addToInstant(start, n, unit, ctx.zone) };
    }
    const ok = result.kind === "date" ? isYmd(result.value) : isCanonicalInstant(result.value);
    return ok ? result : outOfRange;
  } catch {
    return outOfRange;
  }
};

const shiftedType = (types: FormulaResultType[], args: FormulaAST[]): FormulaResultType => {
  const unitNode = args[2];
  if (unitNode?.t !== "str") return "datetime";
  const unit = unitOf(unitNode.v);
  if (unit !== "days" && unit !== "weeks" && unit !== "months" && unit !== "years") return "datetime";
  return staticDateKind(types[0], args[0]) ?? "datetime";
};

const monthsBetween = (a: string, b: string): number => {
  const [earlier, later] = a <= b ? [a, b] : [b, a];
  let m =
    (Number(later.slice(0, 4)) - Number(earlier.slice(0, 4))) * 12 +
    (Number(later.slice(5, 7)) - Number(earlier.slice(5, 7)));
  if (addMonths(earlier, m) > later) m -= 1;
  return a <= b ? m : -m;
};

register({
  name: "now", arity: { min: 0, max: 0 }, paramTypes: [], returnType: "datetime", volatile: "now",
  eval: (_args, ctx) => ({ kind: "datetime", value: ctx.now.toISOString() }),
  doc: "Current timestamp.", category: "date",
});
register({
  name: "today", arity: { min: 0, max: 0 }, paramTypes: [], returnType: "date", volatile: "today",
  eval: (_args, ctx) => ({ kind: "date", value: (ctx.today ??= todayIn(ctx.zone, ctx.now)) }),
  doc: "Today's date in the base time zone.", category: "date",
});
register({
  name: "dateAdd", arity: { min: 3, max: 3 }, paramTypes: ["date", "number", "string"],
  returnType: shiftedType,
  eval: (args, ctx) => shift(args, 1, ctx),
  doc: "Adds an amount to a date. Units: days, weeks, months, years, hours, minutes.", category: "date",
});
register({
  name: "dateSubtract", arity: { min: 3, max: 3 }, paramTypes: ["date", "number", "string"],
  returnType: shiftedType,
  eval: (args, ctx) => shift(args, -1, ctx),
  doc: "Subtracts an amount from a date. Units: days, weeks, months, years, hours, minutes.", category: "date",
});
register({
  name: "dateBetween", arity: { min: 3, max: 3 }, paramTypes: ["date", "date", "string"], returnType: "number",
  eval: ([a, b, unitArg], ctx) => {
    const da = dateArg(a);
    if (!isDateValue(da)) return da;
    const db = dateArg(b);
    if (!isDateValue(db)) return db;
    const unit = unitOf(unitArg);
    if (unit === null) return unknownUnit(unitArg);
    if (unit === "hours" || unit === "minutes") {
      const ms = Date.parse(instantOf(db, ctx.zone)) - Date.parse(instantOf(da, ctx.zone));
      return Math.trunc(ms / (unit === "hours" ? 3_600_000 : 60_000)) + 0;
    }
    const dayA = dayOf(da, ctx.zone);
    const dayB = dayOf(db, ctx.zone);
    if (unit === "days") return diffDays(dayA, dayB) + 0;
    if (unit === "weeks") return Math.trunc(diffDays(dayA, dayB) / 7) + 0;
    const months = monthsBetween(dayA, dayB);
    return (unit === "months" ? months : Math.trunc(months / 12)) + 0;
  },
  doc: "Whole units from the first date to the second. Units: days, weeks, months, years, hours, minutes.", category: "date",
});
register({
  name: "parseDate", arity: { min: 1, max: 1 }, paramTypes: ["string"],
  returnType: (types, args) => staticDateKind(types[0], args[0]) ?? "datetime",
  eval: ([v]) => dateArg(v),
  doc: "Reads text such as 2026-01-31 or 2026-01-31T09:00Z as a date.", category: "date",
});

const wallOf = (d: DateValue, zone: string): WallClock =>
  d.kind === "datetime"
    ? instantToWall(d.value, zone)
    : { ymd: d.value, hour: 0, minute: 0, second: 0, millisecond: 0 };

const PARTS: Array<[string, string, (w: WallClock) => number]> = [
  ["year", "Year of a date.", (w) => Number(w.ymd.slice(0, 4))],
  ["month", "Month of a date, 1 to 12.", (w) => Number(w.ymd.slice(5, 7))],
  ["day", "Day of the month, 1 to 31.", (w) => Number(w.ymd.slice(8, 10))],
  ["hour", "Hour of a date, 0 to 23.", (w) => w.hour],
  ["minute", "Minute of a date, 0 to 59.", (w) => w.minute],
  ["weekday", "Day of the week, 0 for Sunday to 6 for Saturday.", (w) => weekday(w.ymd)],
];

for (const [name, doc, read] of PARTS) {
  register({
    name, arity: { min: 1, max: 1 }, paramTypes: ["date"], returnType: "number",
    eval: ([v], ctx) => {
      const d = dateArg(v);
      return isDateValue(d) ? read(wallOf(d, ctx.zone)) : d;
    },
    doc, category: "date",
  });
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

const FORMAT_TOKENS = new Map<string, (w: WallClock) => string>([
  ["YYYY", (w) => w.ymd.slice(0, 4)],
  ["MM", (w) => w.ymd.slice(5, 7)],
  ["DD", (w) => w.ymd.slice(8, 10)],
  ["HH", (w) => pad2(w.hour)],
  ["mm", (w) => pad2(w.minute)],
  ["ss", (w) => pad2(w.second)],
  ["M", (w) => String(Number(w.ymd.slice(5, 7)))],
  ["D", (w) => String(Number(w.ymd.slice(8, 10)))],
  ["H", (w) => String(w.hour)],
]);

const FORMAT_RUN = /([A-Za-z])\1*/g;

register({
  name: "formatDate", arity: { min: 2, max: 2 }, paramTypes: ["date", "string"], returnType: "string",
  eval: ([v, pattern], ctx) => {
    const d = dateArg(v);
    if (!isDateValue(d)) return d;
    const w = wallOf(d, ctx.zone);
    return valueToString(pattern, ctx.zone).replace(
      FORMAT_RUN,
      (run) => FORMAT_TOKENS.get(run)?.(w) ?? run,
    );
  },
  doc: "Formats a date as text. Tokens: YYYY, MM, DD, HH, mm, ss, M, D, H.", category: "date",
});
