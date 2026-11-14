import { z } from "zod";
import {
  CURRENCY_SYMBOLS,
  LOOSE_FALSE_WORDS,
  LOOSE_TRUE_WORDS,
  MONTH_NAMES,
  NULL_MARKERS,
  STRICT_FALSE_WORDS,
  STRICT_TRUE_WORDS,
} from "@/ee/base/csv-import/csv-import.constants";
import type {
  CsvDateOrder,
  CsvDecimalSeparator,
  CsvListSeparator,
} from "@/ee/base/csv-import/csv-import.types";

export type ParsedNumber = {
  value: number;
  wholeDigits: number;
  leadingZero: boolean;
  percent: boolean;
  currency: string | null;
};

export type ParsedDate = {
  iso: string;
  hasTime: boolean;
  hour12: boolean;
};

type TimeParts = {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  meridiem: "am" | "pm" | null;
};

const DOT_DECIMAL = /^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)$/i;
const COMMA_DECIMAL = /^(?:(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?|,\d+)$/;
const DIGIT_GROUP_SPACE = /(\d)[    '](?=\d{3}(?:\D|$))/g;

const TIME = String.raw`(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?\s*([ap])?\.?\s?(?:m\.?)?`;
const ZONE = String.raw`(z|utc|gmt|[+-]\d{2}(?::?\d{2})?)`;
const TIME_SEPARATOR = String.raw`(?:t|\s+|,\s*|\s+at\s+)`;
const YEAR_FIRST_DATE = new RegExp(
  String.raw`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:${TIME_SEPARATOR}${TIME}\s*${ZONE}?)?$`,
  "i",
);
const NUMERIC_DATE = new RegExp(
  String.raw`^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:${TIME_SEPARATOR}${TIME}\s*${ZONE}?)?$`,
  "i",
);
const MONTH_FIRST_DATE = new RegExp(
  String.raw`^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:${TIME_SEPARATOR}${TIME})?$`,
  "i",
);
const DAY_FIRST_DATE = new RegExp(
  String.raw`^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]+)\.?,?[\s-]+(\d{4}|\d{2})(?:${TIME_SEPARATOR}${TIME})?$`,
  "i",
);
const WEEKDAY_PREFIX = /^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i;
const DATE_RANGE_SEPARATOR = /\s+(?:→|->)\s+/;
const BARE_DOMAIN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#]\S*)?$/i;
const NAME_WITH_EMAIL = /<([^<>\s]+@[^<>\s]+)>/;
const FORMULA_APOSTROPHE = /^'(?=[=+\-@])/;

const urlSchema = z.url();
const emailSchema = z.email();

export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

// same as the server: a cut that splits a surrogate pair drops the lone half
export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength);
  const lastCode = cut.charCodeAt(cut.length - 1);
  return lastCode >= 0xd800 && lastCode <= 0xdbff ? cut.slice(0, -1) : cut;
}

// Docmost's export puts an apostrophe before values a spreadsheet would run as formulas
export function stripFormulaApostrophe(value: string): string {
  return value.replace(FORMULA_APOSTROPHE, "");
}

export function isNullMarker(value: string): boolean {
  return NULL_MARKERS.has(value.trim().toLowerCase());
}

export function parseBooleanValue(value: string, loose: boolean): boolean | null {
  const v = value.trim().toLowerCase();
  if ((loose ? LOOSE_TRUE_WORDS : STRICT_TRUE_WORDS).has(v)) return true;
  if ((loose ? LOOSE_FALSE_WORDS : STRICT_FALSE_WORDS).has(v)) return false;
  return null;
}

function stripSign(s: string): { sign: number; rest: string } {
  if (s.startsWith("-")) return { sign: -1, rest: s.slice(1).trim() };
  if (s.startsWith("+")) return { sign: 1, rest: s.slice(1).trim() };
  return { sign: 0, rest: s };
}

function stripCurrency(s: string): { code: string | null; rest: string } {
  const upper = s.toUpperCase();
  for (const { symbol, code } of CURRENCY_SYMBOLS) {
    const sym = symbol.toUpperCase();
    if (upper.startsWith(sym)) return { code, rest: s.slice(symbol.length).trim() };
    if (upper.endsWith(sym)) return { code, rest: s.slice(0, -symbol.length).trim() };
  }
  return { code: null, rest: s };
}

export function parseNumberValue(
  raw: string,
  decimalSeparator: CsvDecimalSeparator,
): ParsedNumber | null {
  let s = raw.trim();
  if (!s) return null;

  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  let percent = false;
  if (s.endsWith("%")) {
    percent = true;
    s = s.slice(0, -1).trim();
  }

  const outer = stripSign(s);
  const currency = stripCurrency(outer.rest);
  const inner = outer.sign === 0 ? stripSign(currency.rest) : { sign: 0, rest: currency.rest };
  if (currency.code && percent) return null;
  if (negative && (outer.sign !== 0 || inner.sign !== 0)) return null;

  const body = inner.rest.replace(DIGIT_GROUP_SPACE, "$1");
  const pattern = decimalSeparator === "." ? DOT_DECIMAL : COMMA_DECIMAL;
  if (!pattern.test(body)) return null;

  const groupSeparator = decimalSeparator === "." ? "," : ".";
  const plain = body.split(groupSeparator).join("");
  const normalized = decimalSeparator === "," ? plain.replace(",", ".") : plain;
  const mantissa = normalized.split(/e/i)[0];
  const [intPart] = mantissa.split(".");

  const sign = outer.sign === -1 || inner.sign === -1 || negative ? -1 : 1;
  const value = Number(normalized) * sign;
  if (!Number.isFinite(value)) return null;

  return {
    value: Object.is(value, -0) ? 0 : value,
    // a long fraction is float output and reads back exactly; only whole-number digits can be lost
    wholeDigits: intPart.length,
    leadingZero: intPart.length > 1 && intPart.startsWith("0"),
    percent,
    currency: currency.code,
  };
}

function expandYear(year: string): number {
  const y = Number(year);
  if (year.length !== 2) return y;
  return y < 70 ? 2000 + y : 1900 + y;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function readTime(match: RegExpMatchArray, offset: number): TimeParts | null {
  if (match[offset] === undefined) return null;
  const meridiem = match[offset + 4]?.toLowerCase();
  return {
    hour: Number(match[offset]),
    minute: Number(match[offset + 1]),
    second: match[offset + 2] ? Number(match[offset + 2]) : 0,
    millisecond: match[offset + 3]
      ? Number(match[offset + 3].slice(0, 3).padEnd(3, "0"))
      : 0,
    meridiem: meridiem === "a" ? "am" : meridiem === "p" ? "pm" : null,
  };
}

function zoneOffsetMinutes(zone: string): number {
  const z = zone.toLowerCase();
  if (z === "z" || z === "utc" || z === "gmt") return 0;
  const sign = z.startsWith("-") ? -1 : 1;
  const digits = z.slice(1).replace(":", "");
  const hours = Number(digits.slice(0, 2));
  const minutes = digits.length > 2 ? Number(digits.slice(2, 4)) : 0;
  return sign * (hours * 60 + minutes);
}

function buildDate(
  year: number,
  month: number,
  day: number,
  time: TimeParts | null,
  zone: string | undefined,
): ParsedDate | null {
  if (year < 1 || year > 9999) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  if (!time) {
    return {
      iso: `${pad(year, 4)}-${pad(month)}-${pad(day)}T00:00:00.000Z`,
      hasTime: false,
      hour12: false,
    };
  }

  let hour = time.hour;
  if (time.meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (time.meridiem === "pm" ? 12 : 0);
  }
  if (hour > 23 || time.minute > 59 || time.second > 59) return null;

  let date: Date;
  if (zone) {
    const utc = Date.UTC(year, month - 1, day, hour, time.minute, time.second, time.millisecond);
    date = new Date(utc - zoneOffsetMinutes(zone) * 60_000);
  } else {
    date = new Date(year, month - 1, day, hour, time.minute, time.second, time.millisecond);
    date.setFullYear(year);
  }
  if (Number.isNaN(date.getTime())) return null;

  return { iso: date.toISOString(), hasTime: true, hour12: time.meridiem !== null };
}

function cleanDateText(raw: string): string {
  const start = raw.trim().split(DATE_RANGE_SEPARATOR)[0];
  return start.replace(WEEKDAY_PREFIX, "").trim();
}

export function matchNumericDateParts(
  raw: string,
): { first: number; second: number; dotted: boolean } | null {
  const text = cleanDateText(raw);
  const match = text.match(NUMERIC_DATE);
  if (!match) return null;
  return {
    first: Number(match[1]),
    second: Number(match[2]),
    dotted: text.charAt(match[1].length) === ".",
  };
}

export function parseDateValue(raw: string, order: CsvDateOrder): ParsedDate | null {
  const s = cleanDateText(raw);
  if (!s || !/\d/.test(s)) return null;

  let match = s.match(YEAR_FIRST_DATE);
  if (match) {
    return buildDate(Number(match[1]), Number(match[2]), Number(match[3]), readTime(match, 4), match[9]);
  }

  match = s.match(NUMERIC_DATE);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const [month, day] = order === "MDY" ? [first, second] : [second, first];
    return buildDate(expandYear(match[3]), month, day, readTime(match, 4), match[9]);
  }

  match = s.match(MONTH_FIRST_DATE);
  if (match) {
    const month = MONTH_NAMES.get(match[1].toLowerCase());
    if (!month) return null;
    return buildDate(Number(match[3]), month, Number(match[2]), readTime(match, 4), undefined);
  }

  match = s.match(DAY_FIRST_DATE);
  if (match) {
    const month = MONTH_NAMES.get(match[2].toLowerCase());
    if (!month) return null;
    return buildDate(expandYear(match[3]), month, Number(match[1]), readTime(match, 4), undefined);
  }

  return null;
}

export function isWebUrl(raw: string): boolean {
  const s = raw.trim();
  if (!/^(?:https?:\/\/|www\.)\S+$/i.test(s)) return false;
  return normalizeUrl(s) !== null;
}

export function normalizeUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  if (/^www\./i.test(s) || (!/^[a-z][a-z0-9+.-]*:/i.test(s) && BARE_DOMAIN.test(s))) {
    s = `https://${s}`;
  }
  if (!/^https?:\/\//i.test(s)) return null;
  return urlSchema.safeParse(s).success ? s : null;
}

export function normalizeEmail(raw: string): string | null {
  const s = raw.trim().replace(/^mailto:/i, "");
  return emailSchema.safeParse(s).success ? s : null;
}

// the export guards each list item on its own
export function splitListValue(raw: string, separator: CsvListSeparator): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(separator)) {
    const token = stripFormulaApostrophe(part.trim());
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

export function personToken(raw: string): string {
  const email = raw.match(NAME_WITH_EMAIL)?.[1];
  return email ?? raw.trim();
}

export function localeDateOrder(locale: string): CsvDateOrder {
  try {
    const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2026, 10, 13));
    const month = parts.findIndex((p) => p.type === "month");
    const day = parts.findIndex((p) => p.type === "day");
    return month !== -1 && day !== -1 && month > day ? "DMY" : "MDY";
  } catch {
    return "MDY";
  }
}

export function localeDecimalSeparator(locale: string): CsvDecimalSeparator {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1.5);
    return parts.find((p) => p.type === "decimal")?.value === "," ? "," : ".";
  } catch {
    return ".";
  }
}
