export type DateValue = { start: string; end?: string };

export const DATE_FORMATS = [
  "full",
  "medium",
  "monthDayYear",
  "dayMonthYear",
  "yearMonthDay",
  "relative",
] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const MIN_PICKER_DATE = "0100-01-01";
export const MAX_PICKER_DATE = "9999-12-31";

type FormatDateValueOptions = {
  dateFormat?: DateFormat;
  timeFormat?: "12h" | "24h";
  locale: string;
  now?: Date;
};

const MAX_PART_LENGTH = 40;
const DAY_MS = 86_400_000;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT_INPUT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?(Z|([+-])(0\d|1[0-5]):([0-5]\d))$/;
const LEGACY_MIDNIGHT_RE = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0{1,3})?Z$/;
const CANONICAL_YEAR_RE = /^(?!0000)\d{4}-/;

const FULL_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};
const MEDIUM_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};
const NUMERIC_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};
const TIME_OPTIONS: Record<"12h" | "24h", Intl.DateTimeFormatOptions> = {
  "12h": { hour: "numeric", minute: "2-digit", hourCycle: "h12" },
  "24h": { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
};
const LOCALE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};
const NUMERIC_DATE_ORDERS: Partial<
  Record<DateFormat, ("year" | "month" | "day")[]>
> = {
  monthDayYear: ["month", "day", "year"],
  dayMonthYear: ["day", "month", "year"],
  yearMonthDay: ["year", "month", "day"],
};

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>();

function getDateTimeFormat(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dateTimeFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateTimeFormats.set(key, format);
  }
  return format;
}

function toSupportedLocale(locale: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return undefined;
  }
}

function ymdParts(ymd: string): [number, number, number] | null {
  const m = YMD_RE.exec(ymd);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function requireYmdParts(ymd: string): [number, number, number] {
  const parts = ymdParts(ymd);
  if (!parts) throw new RangeError(`Invalid calendar date: ${ymd}`);
  return parts;
}

function isValidYmd(s: string): boolean {
  const parts = ymdParts(s);
  if (!parts) return false;
  const [y, mo, d] = parts;
  if (y < 1) return false;
  const probe = new Date(0);
  probe.setUTCFullYear(y, mo - 1, d);
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === mo - 1 &&
    probe.getUTCDate() === d
  );
}

function toCanonicalInstant(s: string): string | null {
  const m = INSTANT_INPUT_RE.exec(s);
  if (!m || !isValidYmd(`${m[1]}-${m[2]}-${m[3]}`)) return null;
  const local = new Date(0);
  local.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  local.setUTCHours(
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0),
    Number((m[7] ?? "0").padEnd(3, "0")),
  );
  const offsetMinutes =
    m[8] === "Z"
      ? 0
      : (m[9] === "-" ? -1 : 1) * (Number(m[10]) * 60 + Number(m[11]));
  const iso = new Date(local.getTime() - offsetMinutes * 60_000).toISOString();
  return CANONICAL_YEAR_RE.test(iso) ? iso : null;
}

function parsePart(s: unknown): string | null {
  if (typeof s !== "string" || s.length > MAX_PART_LENGTH) return null;
  if (isValidYmd(s)) return s;
  return toCanonicalInstant(s);
}

function isEndOrdered(start: string, end: string): boolean {
  if (isDateOnly(start) !== isDateOnly(end)) return false;
  return isDateOnly(start)
    ? end >= start
    : Date.parse(end) >= Date.parse(start);
}

export function isDateOnly(part: string): boolean {
  return YMD_RE.test(part);
}

export function parseDateValue(raw: unknown): DateValue | null {
  if (typeof raw === "string") {
    const midnight = LEGACY_MIDNIGHT_RE.exec(raw);
    if (midnight) {
      return isValidYmd(midnight[1]) ? { start: midnight[1] } : null;
    }
    const start = parsePart(raw);
    return start ? { start } : null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const { start: rawStart, end: rawEnd } = raw as Record<string, unknown>;
  const start = parsePart(rawStart);
  if (!start) return null;
  const end = parsePart(rawEnd);
  return end && isEndOrdered(start, end) ? { start, end } : { start };
}

function partToLocalDate(part: string): Date {
  const parts = ymdParts(part);
  if (!parts) return new Date(part);
  const [y, mo, d] = parts;
  const date = new Date(y, mo - 1, d);
  date.setFullYear(y, mo - 1, d);
  return date;
}

export function localDateToYmd(d: Date): string {
  const year = String(d.getFullYear()).padStart(4, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function partToLocalYmd(part: string): string {
  return isDateOnly(part) ? part : localDateToYmd(new Date(part));
}

export function localPartsToInstant(
  ymd: string,
  hours: number,
  minutes: number,
  seconds = 0,
): string {
  const [y, mo, d] = requireYmdParts(ymd);
  const date = new Date(y, mo - 1, d, hours, minutes, seconds);
  date.setFullYear(y, mo - 1, d);
  return date.toISOString();
}

function ymdToUtcDate(ymd: string): Date {
  const [y, mo, d] = requireYmdParts(ymd);
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  return date;
}

function partToUtcDay(part: string): number {
  return Math.round(ymdToUtcDate(partToLocalYmd(part)).getTime() / DAY_MS);
}

function formatRelativeDay(
  part: string,
  locale: string | undefined,
  now: Date,
): string | null {
  const diff = partToUtcDay(part) - partToUtcDay(localDateToYmd(now));
  if (Math.abs(diff) > 1) return null;
  let format = relativeTimeFormats.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeTimeFormats.set(locale, format);
  }
  const text = format.format(diff, "day");
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

function formatDatePart(
  part: string,
  dateFormat: DateFormat,
  locale: string | undefined,
  now: Date,
): string {
  if (dateFormat === "relative") {
    const relative = formatRelativeDay(part, locale, now);
    if (relative) return relative;
  }

  const dateOnly = isDateOnly(part);
  const date = dateOnly ? ymdToUtcDate(part) : new Date(part);
  const timeZone = dateOnly ? "UTC" : undefined;

  const order = NUMERIC_DATE_ORDERS[dateFormat];
  if (!order) {
    const options =
      dateFormat === "full" ? FULL_DATE_OPTIONS : MEDIUM_DATE_OPTIONS;
    return getDateTimeFormat(locale, { ...options, timeZone }).format(date);
  }
  const parts = getDateTimeFormat(locale, {
    ...NUMERIC_DATE_OPTIONS,
    timeZone,
  }).formatToParts(date);
  return order
    .map((type) => parts.find((p) => p.type === type)?.value)
    .join("/");
}

function formatTimePart(
  part: string,
  timeFormat: "12h" | "24h" | undefined,
  locale: string | undefined,
): string {
  const options = timeFormat ? TIME_OPTIONS[timeFormat] : LOCALE_TIME_OPTIONS;
  return getDateTimeFormat(locale, options).format(new Date(part));
}

export function formatTimeOfDay(
  part: string,
  opts: { timeFormat?: "12h" | "24h"; locale: string },
): string {
  return formatTimePart(part, opts.timeFormat, toSupportedLocale(opts.locale));
}

export function formatDateValue(
  v: DateValue | null,
  opts: FormatDateValueOptions,
): string {
  if (!v) return "";
  const dateFormat: DateFormat = DATE_FORMATS.includes(opts.dateFormat)
    ? opts.dateFormat
    : "medium";
  const timeFormat =
    opts.timeFormat === "12h" || opts.timeFormat === "24h"
      ? opts.timeFormat
      : undefined;
  const locale = toSupportedLocale(opts.locale);
  const now = opts.now ?? new Date();

  const formatPart = (part: string) => {
    const date = formatDatePart(part, dateFormat, locale, now);
    return isDateOnly(part)
      ? date
      : `${date} ${formatTimePart(part, timeFormat, locale)}`;
  };

  const start = formatPart(v.start);
  if (!v.end || v.end === v.start) return start;
  if (isDateOnly(v.start)) return `${start} → ${formatPart(v.end)}`;
  const sameDay =
    localDateToYmd(new Date(v.start)) === localDateToYmd(new Date(v.end));
  const end = sameDay
    ? formatTimePart(v.end, timeFormat, locale)
    : formatPart(v.end);
  return `${start} → ${end}`;
}

export function dateValuesEqual(
  a: DateValue | null,
  b: DateValue | null,
): boolean {
  if (!a || !b) return !a && !b;
  return a.start === b.start && (a.end ?? null) === (b.end ?? null);
}

export function compareDateValues(
  a: DateValue | null,
  b: DateValue | null,
): number {
  if (!a || !b) return !a && !b ? 0 : a ? -1 : 1;
  return Math.sign(
    partToLocalDate(a.start).getTime() - partToLocalDate(b.start).getTime(),
  );
}

export function resolveTimeFormat(
  timeFormat: "12h" | "24h" | undefined,
  locale: string,
): "12h" | "24h" {
  if (timeFormat === "12h" || timeFormat === "24h") return timeFormat;
  const { hour12 } = getDateTimeFormat(toSupportedLocale(locale), {
    hour: "numeric",
  }).resolvedOptions();
  return hour12 ? "12h" : "24h";
}

export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
