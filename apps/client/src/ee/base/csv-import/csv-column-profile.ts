import {
  DISTINCT_VALUE_CAP,
  MAX_CHOICE_NAME_LENGTH,
  MAX_LONG_TEXT_LENGTH,
  MAX_SAFE_DIGITS,
  MAX_TEXT_LENGTH,
  MULTI_SELECT_MAX_DISTINCT,
  MULTI_SELECT_MAX_TOKEN_LENGTH,
  SELECT_MAX_DISTINCT,
  SELECT_MAX_LENGTH,
  SELECT_MIN_VALUES,
} from "@/ee/base/csv-import/csv-import.constants";
import {
  isBlank,
  isNullMarker,
  isWebUrl,
  localeDateOrder,
  localeDecimalSeparator,
  matchNumericDateParts,
  normalizeEmail,
  normalizeUrl,
  parseBooleanValue,
  parseDateValue,
  parseNumberValue,
  splitListValue,
} from "@/ee/base/csv-import/csv-value-parsers";
import type {
  CsvColumnProfile,
  CsvDateOrder,
  CsvDecimalSeparator,
  CsvListSeparator,
  CsvParseHints,
  CsvTypeSuggestion,
} from "@/ee/base/csv-import/csv-import.types";

type NumberStats = {
  ok: number;
  leadingZero: number;
  longDigits: number;
  percent: number;
  currencies: Map<string, number>;
};

type TokenStats = {
  distinct: Set<string>;
  overflow: boolean;
  total: number;
  multiValueRows: number;
  maxTokenLength: number;
  tooLong: number;
};

export type CsvColumnStats = {
  nonEmpty: number;
  nullMarkers: number;
  maxLength: number;
  hasNewline: boolean;
  distinct: Set<string>;
  distinctOverflow: boolean;
  textTooLong: number;
  longTextTooLong: number;
  choiceTooLong: number;
  strictBoolean: number;
  looseBoolean: number;
  emails: number;
  webUrls: number;
  looseUrls: number;
  numbers: Record<CsvDecimalSeparator, NumberStats>;
  dates: Record<CsvDateOrder, number>;
  dateTimes: number;
  date12h: number;
  dayFirstEvidence: number;
  monthFirstEvidence: number;
  dottedDates: number;
  tokens: Record<CsvListSeparator, TokenStats>;
};

const UTC_MIDNIGHT = "T00:00:00.000Z";

const createNumberStats = (): NumberStats => ({
  ok: 0,
  leadingZero: 0,
  longDigits: 0,
  percent: 0,
  currencies: new Map(),
});

const createTokenStats = (): TokenStats => ({
  distinct: new Set(),
  overflow: false,
  total: 0,
  multiValueRows: 0,
  maxTokenLength: 0,
  tooLong: 0,
});

export function createColumnStats(): CsvColumnStats {
  return {
    nonEmpty: 0,
    nullMarkers: 0,
    maxLength: 0,
    hasNewline: false,
    distinct: new Set(),
    distinctOverflow: false,
    textTooLong: 0,
    longTextTooLong: 0,
    choiceTooLong: 0,
    strictBoolean: 0,
    looseBoolean: 0,
    emails: 0,
    webUrls: 0,
    looseUrls: 0,
    numbers: { ".": createNumberStats(), ",": createNumberStats() },
    dates: { MDY: 0, DMY: 0 },
    dateTimes: 0,
    date12h: 0,
    dayFirstEvidence: 0,
    monthFirstEvidence: 0,
    dottedDates: 0,
    tokens: { ",": createTokenStats(), ";": createTokenStats() },
  };
}

function addTokens(stats: TokenStats, tokens: string[]): void {
  stats.total += tokens.length;
  if (tokens.length > 1) stats.multiValueRows++;
  for (const token of tokens) {
    if (token.length > stats.maxTokenLength) stats.maxTokenLength = token.length;
    if (token.length > MAX_CHOICE_NAME_LENGTH) stats.tooLong++;
    const key = token.toLowerCase();
    if (stats.distinct.has(key)) continue;
    if (stats.distinct.size < DISTINCT_VALUE_CAP) stats.distinct.add(key);
    else stats.overflow = true;
  }
}

function addNumber(stats: NumberStats, raw: string, separator: CsvDecimalSeparator): void {
  const parsed = parseNumberValue(raw, separator);
  if (!parsed) return;
  stats.ok++;
  if (parsed.leadingZero) stats.leadingZero++;
  if (parsed.wholeDigits > MAX_SAFE_DIGITS) stats.longDigits++;
  if (parsed.percent) stats.percent++;
  if (parsed.currency) {
    stats.currencies.set(parsed.currency, (stats.currencies.get(parsed.currency) ?? 0) + 1);
  }
}

export function addColumnValue(stats: CsvColumnStats, raw: string | undefined): void {
  if (raw === undefined || isBlank(raw)) return;
  const value = raw.trim();
  stats.nonEmpty++;

  if (value.length > stats.maxLength) stats.maxLength = value.length;
  if (!stats.hasNewline && /[\r\n]/.test(value)) stats.hasNewline = true;
  if (value.length > MAX_TEXT_LENGTH) stats.textTooLong++;
  if (value.length > MAX_LONG_TEXT_LENGTH) stats.longTextTooLong++;
  if (value.length > MAX_CHOICE_NAME_LENGTH) stats.choiceTooLong++;

  const key = value.toLowerCase();
  if (!stats.distinct.has(key)) {
    if (stats.distinct.size < DISTINCT_VALUE_CAP) {
      stats.distinct.add(key);
    } else {
      stats.distinctOverflow = true;
    }
  }

  addTokens(stats.tokens[","], splitListValue(value, ","));
  addTokens(stats.tokens[";"], splitListValue(value, ";"));

  if (isNullMarker(value)) {
    stats.nullMarkers++;
    return;
  }

  if (parseBooleanValue(value, false) !== null) stats.strictBoolean++;
  if (parseBooleanValue(value, true) !== null) stats.looseBoolean++;
  if (normalizeEmail(value)) stats.emails++;
  if (isWebUrl(value)) stats.webUrls++;
  if (normalizeUrl(value)) stats.looseUrls++;

  if (!/\d/.test(value)) return;

  addNumber(stats.numbers["."], value, ".");
  addNumber(stats.numbers[","], value, ",");

  const monthFirst = parseDateValue(value, "MDY");
  const dayFirst = parseDateValue(value, "DMY");
  if (monthFirst) stats.dates.MDY++;
  if (dayFirst) stats.dates.DMY++;
  const parsedDate = monthFirst ?? dayFirst;
  // UTC midnight is how date-only cells are stored and exported
  if (parsedDate?.hasTime && !parsedDate.iso.endsWith(UTC_MIDNIGHT)) stats.dateTimes++;
  if (parsedDate?.hour12) stats.date12h++;

  const parts = matchNumericDateParts(value);
  if (parts) {
    if (parts.first > 12 && parts.second <= 12) stats.dayFirstEvidence++;
    if (parts.second > 12 && parts.first <= 12) stats.monthFirstEvidence++;
    if (parts.dotted) stats.dottedDates++;
  }
}

function pickHints(stats: CsvColumnStats, locale: string): CsvParseHints {
  const dot = stats.numbers["."].ok;
  const comma = stats.numbers[","].ok;
  const decimalSeparator: CsvDecimalSeparator =
    comma > dot ? "," : dot > comma ? "." : localeDecimalSeparator(locale);

  let dateOrder: CsvDateOrder;
  if (stats.dayFirstEvidence !== stats.monthFirstEvidence) {
    dateOrder = stats.dayFirstEvidence > stats.monthFirstEvidence ? "DMY" : "MDY";
  } else if (stats.dates.DMY !== stats.dates.MDY) {
    dateOrder = stats.dates.DMY > stats.dates.MDY ? "DMY" : "MDY";
  } else if (stats.dottedDates > 0) {
    // 03.04.2026 is day-first wherever dots are used
    dateOrder = "DMY";
  } else {
    dateOrder = localeDateOrder(locale);
  }

  const listSeparator: CsvListSeparator =
    stats.tokens[";"].multiValueRows > 0 ? ";" : ",";

  return { dateOrder, decimalSeparator, listSeparator };
}

function numberTypeOptions(stats: NumberStats, typed: number): Record<string, unknown> {
  const options: Record<string, unknown> = { separators: "local" };
  if (stats.percent === typed) {
    options.format = "percent";
    return options;
  }
  if (stats.currencies.size === 1) {
    const [code, count] = stats.currencies.entries().next().value as [string, number];
    if (count === typed) {
      options.format = "currency";
      options.currencyCode = code;
    }
  }
  return options;
}

function suggestType(
  stats: CsvColumnStats,
  hints: CsvParseHints,
  header: string,
): CsvTypeSuggestion {
  if (stats.nonEmpty === 0) return { type: "text" };

  const typed = stats.nonEmpty - stats.nullMarkers;
  if (typed > 0) {
    const numbers = stats.numbers[hints.decimalSeparator];
    if (stats.strictBoolean === typed) return { type: "checkbox" };
    if (numbers.ok === typed && numbers.leadingZero === 0 && numbers.longDigits === 0) {
      return { type: "number", typeOptions: numberTypeOptions(numbers, typed) };
    }
    if (stats.dates[hints.dateOrder] === typed) {
      return {
        type: "date",
        typeOptions:
          stats.dateTimes > 0
            ? { includeTime: true, timeFormat: stats.date12h > 0 ? "12h" : "24h" }
            : undefined,
      };
    }
    if (stats.emails === typed) return { type: "email" };
    if (stats.webUrls === typed) return { type: "url" };
  }

  if (!stats.hasNewline && stats.nonEmpty >= SELECT_MIN_VALUES) {
    const tokens = stats.tokens[hints.listSeparator];
    if (
      tokens.multiValueRows > 0 &&
      !tokens.overflow &&
      tokens.distinct.size <= MULTI_SELECT_MAX_DISTINCT &&
      tokens.maxTokenLength <= MULTI_SELECT_MAX_TOKEN_LENGTH &&
      tokens.total >= tokens.distinct.size * 1.5
    ) {
      return { type: "multiSelect" };
    }
    if (
      !stats.distinctOverflow &&
      stats.distinct.size <= SELECT_MAX_DISTINCT &&
      stats.maxLength <= SELECT_MAX_LENGTH &&
      stats.distinct.size * 2 <= stats.nonEmpty + 1
    ) {
      return { type: header.trim().toLowerCase() === "status" ? "status" : "select" };
    }
  }

  if (stats.hasNewline || stats.maxLength > MAX_TEXT_LENGTH) return { type: "longText" };
  return { type: "text" };
}

export function finalizeColumnProfile(
  stats: CsvColumnStats,
  header: string,
  locale: string,
): CsvColumnProfile {
  const hints = pickHints(stats, locale);
  const typed = stats.nonEmpty - stats.nullMarkers;
  return {
    nonEmpty: stats.nonEmpty,
    distinctCount: stats.distinct.size,
    distinctTokenCount: stats.tokens[hints.listSeparator].distinct.size,
    hasMultipleValues: stats.tokens[hints.listSeparator].multiValueRows > 0,
    hints,
    suggestion: suggestType(stats, hints, header),
    issues: {
      text: stats.textTooLong,
      longText: stats.longTextTooLong,
      number: typed - stats.numbers[hints.decimalSeparator].ok,
      date: typed - stats.dates[hints.dateOrder],
      checkbox: typed - stats.looseBoolean,
      url: typed - stats.looseUrls,
      email: typed - stats.emails,
      select: stats.choiceTooLong,
      status: stats.choiceTooLong,
      multiSelect: stats.tokens[hints.listSeparator].tooLong,
    },
  };
}
