import {
  MAX_CHOICE_NAME_LENGTH,
  MAX_LONG_TEXT_LENGTH,
  MAX_MULTI_VALUES,
  MAX_TEXT_LENGTH,
} from "@/ee/base/csv-import/csv-import.constants";
import {
  isBlank,
  isNullMarker,
  normalizeEmail,
  normalizeUrl,
  parseBooleanValue,
  parseDateValue,
  parseNumberValue,
  personToken,
  splitListValue,
  stripFormulaApostrophe,
  truncateText,
} from "@/ee/base/csv-import/csv-value-parsers";
import type {
  CsvConvertResult,
  CsvImportPropertyType,
  CsvImportValue,
  CsvParseHints,
} from "@/ee/base/csv-import/csv-import.types";

const EMPTY: CsvConvertResult = { value: null, status: "empty" };
const INVALID: CsvConvertResult = { value: null, status: "invalid" };

const ok = (value: CsvImportValue): CsvConvertResult => ({ value, status: "ok" });

function truncate(value: string, max: number): CsvConvertResult {
  return value.length > max
    ? { value: truncateText(value, max), status: "truncated" }
    : ok(value);
}

// items over the name limit or past the per-cell cap are counted as skipped
function convertList(value: string, hints: CsvParseHints): CsvConvertResult {
  const tokens = splitListValue(value, hints.listSeparator);
  if (tokens.length === 0) return EMPTY;
  const kept = tokens
    .filter((token) => token.length <= MAX_CHOICE_NAME_LENGTH)
    .slice(0, MAX_MULTI_VALUES);
  const skipped = tokens.length - kept.length;
  if (kept.length === 0) return { ...INVALID, skipped };
  return skipped > 0 ? { value: kept, status: "truncated", skipped } : ok(kept);
}

export function convertCsvValue(
  raw: string | undefined,
  type: CsvImportPropertyType,
  hints: CsvParseHints,
): CsvConvertResult {
  if (raw === undefined || isBlank(raw)) return EMPTY;
  const value = raw.trim();

  switch (type) {
    case "text":
      return truncate(stripFormulaApostrophe(value), MAX_TEXT_LENGTH);
    case "longText":
      return truncate(stripFormulaApostrophe(value), MAX_LONG_TEXT_LENGTH);
    case "select":
    case "status": {
      const name = stripFormulaApostrophe(value);
      return name.length > MAX_CHOICE_NAME_LENGTH ? INVALID : ok(name);
    }
    case "multiSelect":
      return convertList(value, hints);
    case "person": {
      const tokens = splitListValue(value, hints.listSeparator).map(personToken);
      return tokens.length > 0 ? ok(tokens) : EMPTY;
    }
  }

  if (isNullMarker(value)) return EMPTY;

  switch (type) {
    case "number": {
      const parsed = parseNumberValue(value, hints.decimalSeparator);
      return parsed ? ok(parsed.value) : INVALID;
    }
    case "date": {
      const parsed = parseDateValue(value, hints.dateOrder);
      return parsed ? ok(parsed.iso) : INVALID;
    }
    case "checkbox": {
      const parsed = parseBooleanValue(value, true);
      return parsed === null ? INVALID : ok(parsed);
    }
    case "url": {
      const url = normalizeUrl(stripFormulaApostrophe(value));
      return url ? ok(url) : INVALID;
    }
    case "email": {
      const email = normalizeEmail(stripFormulaApostrophe(value));
      return email ? ok(email) : INVALID;
    }
  }

  return INVALID;
}
