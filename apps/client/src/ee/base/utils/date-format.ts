import { diffDays, isValidTimeZone, partKind, type DateCell } from "@docmost/base-formula/client";
import { partDayIn } from "@/ee/base/utils/date-cell";
import type { DateTypeOptions } from "@/ee/base/types/base.types";

export const DATE_FORMATS = [
  "full",
  "medium",
  "monthDayYear",
  "dayMonthYear",
  "yearMonthDay",
  "relative",
] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
export type TimeFormat = "12h" | "24h";

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  full: "Full date",
  medium: "Month day, year",
  monthDayYear: "Month/Day/Year",
  dayMonthYear: "Day/Month/Year",
  yearMonthDay: "Year/Month/Day",
  relative: "Relative",
};

export const TIME_FORMAT_LABELS: Record<TimeFormat, string> = {
  "12h": "12-hour",
  "24h": "24-hour",
};

export type DateDisplayOptions = {
  dateFormat?: DateFormat;
  timeFormat?: TimeFormat;
  locale: string;
  timeZone: string;
  today: string;
};

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
const TIME_OPTIONS: Record<TimeFormat, Intl.DateTimeFormatOptions> = {
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

const MAX_CACHED_FORMATS = 200;

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>();

function setBounded<V>(cache: Map<string, V>, key: string, value: V) {
  if (cache.size >= MAX_CACHED_FORMATS) {
    cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, value);
}

function zoneOrUtc(timeZone: string): string {
  return isValidTimeZone(timeZone) ? timeZone : "UTC";
}

function getDateTimeFormat(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dateTimeFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    setBounded(dateTimeFormats, key, format);
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

function ymdToUtcDate(ymd: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  return date;
}

function formatRelativeDay(
  day: string | null,
  today: string,
  locale: string | undefined,
): string | null {
  if (day === null) return null;
  const diff = diffDays(today, day);
  if (Math.abs(diff) > 1) return null;
  const key = locale ?? "";
  let format = relativeTimeFormats.get(key);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    setBounded(relativeTimeFormats, key, format);
  }
  const text = format.format(diff, "day");
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

function formatDatePart(
  part: string,
  dateFormat: DateFormat,
  locale: string | undefined,
  opts: DateDisplayOptions,
): string {
  if (dateFormat === "relative") {
    const relative = formatRelativeDay(
      partDayIn(part, opts.timeZone),
      opts.today,
      locale,
    );
    if (relative) return relative;
  }

  const dateOnly = partKind(part) === "date";
  const date = dateOnly ? ymdToUtcDate(part) : new Date(part);
  const timeZone = dateOnly ? "UTC" : opts.timeZone;

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
  instant: string,
  timeFormat: TimeFormat | undefined,
  locale: string | undefined,
  timeZone: string,
): string {
  const options = timeFormat ? TIME_OPTIONS[timeFormat] : LOCALE_TIME_OPTIONS;
  return getDateTimeFormat(locale, { ...options, timeZone }).format(
    new Date(instant),
  );
}

export function formatTimeOfDay(
  instant: string,
  opts: { timeFormat?: TimeFormat; locale: string; timeZone: string },
): string {
  return formatTimePart(
    instant,
    opts.timeFormat,
    toSupportedLocale(opts.locale),
    zoneOrUtc(opts.timeZone),
  );
}

export function formatDateCell(
  cell: DateCell | null,
  displayOpts: DateDisplayOptions,
): string {
  if (!cell) return "";
  const opts = { ...displayOpts, timeZone: zoneOrUtc(displayOpts.timeZone) };
  const dateFormat: DateFormat = DATE_FORMATS.includes(opts.dateFormat as DateFormat)
    ? (opts.dateFormat as DateFormat)
    : "medium";
  const timeFormat =
    opts.timeFormat === "12h" || opts.timeFormat === "24h"
      ? opts.timeFormat
      : undefined;
  const locale = toSupportedLocale(opts.locale);

  const formatPart = (part: string) => {
    const date = formatDatePart(part, dateFormat, locale, opts);
    return partKind(part) === "date"
      ? date
      : `${date} ${formatTimePart(part, timeFormat, locale, opts.timeZone)}`;
  };

  const start = formatPart(cell.start);
  if (!cell.end || cell.end === cell.start) return start;
  if (partKind(cell.start) === "date") return `${start} → ${formatPart(cell.end)}`;
  const startDay = partDayIn(cell.start, opts.timeZone);
  const end =
    startDay !== null && startDay === partDayIn(cell.end, opts.timeZone)
      ? formatTimePart(cell.end, timeFormat, locale, opts.timeZone)
      : formatPart(cell.end);
  return `${start} → ${end}`;
}

export function formatZoneLabel(
  instant: string,
  timeZone: string,
  locale: string,
): string {
  const zone = zoneOrUtc(timeZone);
  const name = getDateTimeFormat(toSupportedLocale(locale), {
    timeZone: zone,
    timeZoneName: "short",
  })
    .formatToParts(new Date(instant))
    .find((p) => p.type === "timeZoneName")?.value;
  return name ?? zone;
}

export function resolveTimeFormat(
  timeFormat: TimeFormat | undefined,
  locale: string,
): TimeFormat {
  if (timeFormat === "12h" || timeFormat === "24h") return timeFormat;
  const { hour12 } = getDateTimeFormat(toSupportedLocale(locale), {
    hour: "numeric",
  }).resolvedOptions();
  return hour12 ? "12h" : "24h";
}

export function dateTypeOptionsOf(typeOptions: unknown): DateTypeOptions {
  if (typeof typeOptions !== "object" || typeOptions === null) return {};
  const { dateFormat, timeFormat, includeTime } = typeOptions as Record<
    string,
    unknown
  >;
  const result: DateTypeOptions = {};
  if (DATE_FORMATS.includes(dateFormat as DateFormat)) {
    result.dateFormat = dateFormat as DateFormat;
  }
  if (timeFormat === "12h" || timeFormat === "24h") result.timeFormat = timeFormat;
  if (typeof includeTime === "boolean") result.includeTime = includeTime;
  return result;
}
