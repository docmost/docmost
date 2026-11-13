import type {
  CsvDelimiter,
  CsvImportPropertyType,
} from "@/ee/base/csv-import/csv-import.types";

export const MAX_IMPORT_ROWS = 100_000;
export const MAX_IMPORT_COLUMNS = 200;
export const MAX_IMPORT_CHOICES = 500;
export const MAX_CHOICE_NAME_LENGTH = 255;
export const MAX_PROPERTY_NAME_LENGTH = 255;
export const MAX_TEXT_LENGTH = 1000;
export const MAX_LONG_TEXT_LENGTH = 25000;
export const MAX_MULTI_VALUES = 100;

export const PREVIEW_ROW_COUNT = 20;
export const PREVIEW_CELL_MAX_LENGTH = 30000;
export const SAMPLE_VALUE_COUNT = 3;
export const DISTINCT_VALUE_CAP = 1000;

export const SELECT_MAX_DISTINCT = 50;
export const SELECT_MAX_LENGTH = 50;
export const SELECT_MIN_VALUES = 3;
export const MULTI_SELECT_MAX_DISTINCT = 50;
export const MULTI_SELECT_MAX_TOKEN_LENGTH = 50;
export const MAX_SAFE_DIGITS = 15;

// same order the server and the choice editor use for new choices
export const CHOICE_COLORS = [
  "gray",
  "red",
  "pink",
  "grape",
  "violet",
  "indigo",
  "blue",
  "cyan",
  "teal",
  "green",
  "lime",
  "yellow",
  "orange",
];

export const STATUS_COMPLETE_WORDS = new Set([
  "done",
  "complete",
  "completed",
  "closed",
  "resolved",
  "finished",
  "shipped",
  "archived",
  "canceled",
  "cancelled",
  "won't do",
  "wont do",
]);

export const STATUS_IN_PROGRESS_WORDS = new Set([
  "in progress",
  "doing",
  "started",
  "active",
  "in review",
  "review",
  "blocked",
  "ongoing",
  "wip",
]);

export const STATUS_CATEGORY_COLORS = {
  todo: "gray",
  inProgress: "blue",
  complete: "green",
} as const;

export const CSV_EXTENSIONS = new Set(["csv", "tsv", "txt"]);
export const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xlsm", "xls", "ods", "numbers"]);

export const IMPORT_FILE_NAME = "rows.jsonl";
export const IMPORT_FILE_TYPE = "application/x-ndjson";

export const CSV_IMPORT_PROPERTY_TYPES: CsvImportPropertyType[] = [
  "text",
  "longText",
  "number",
  "select",
  "status",
  "multiSelect",
  "date",
  "person",
  "checkbox",
  "url",
  "email",
];

export const CSV_DELIMITERS: { value: CsvDelimiter; label: string }[] = [
  { value: ",", label: "Comma" },
  { value: ";", label: "Semicolon" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe" },
];

export const CSV_ENCODINGS: { value: string; label: string }[] = [
  { value: "utf-8", label: "UTF-8" },
  { value: "utf-16le", label: "UTF-16 LE" },
  { value: "utf-16be", label: "UTF-16 BE" },
  { value: "windows-1252", label: "Western (Windows-1252)" },
  { value: "windows-1250", label: "Central European (Windows-1250)" },
  { value: "windows-1251", label: "Cyrillic (Windows-1251)" },
  { value: "iso-8859-15", label: "Western (ISO-8859-15)" },
  { value: "shift_jis", label: "Japanese (Shift_JIS)" },
  { value: "gb18030", label: "Chinese Simplified (GB18030)" },
  { value: "big5", label: "Chinese Traditional (Big5)" },
  { value: "euc-kr", label: "Korean (EUC-KR)" },
];

export const NULL_MARKERS = new Set([
  "n/a",
  "na",
  "#n/a",
  "-",
  "--",
  "—",
  "null",
  "nil",
  "none",
  "undefined",
]);

export const STRICT_TRUE_WORDS = new Set([
  "true",
  "yes",
  "checked",
  "ja",
  "wahr",
  "oui",
  "vrai",
  "sí",
  "si",
  "sim",
  "✓",
  "✔",
  "☑",
  "✅",
]);
export const STRICT_FALSE_WORDS = new Set([
  "false",
  "no",
  "unchecked",
  "nein",
  "falsch",
  "non",
  "faux",
  "não",
  "nao",
  "✗",
  "✘",
  "☐",
  "❌",
]);
export const LOOSE_TRUE_WORDS = new Set([...STRICT_TRUE_WORDS, "y", "on", "1", "x"]);
export const LOOSE_FALSE_WORDS = new Set([...STRICT_FALSE_WORDS, "n", "off", "0"]);

// longest symbols first so "US$" wins over "$"
export const CURRENCY_SYMBOLS: { symbol: string; code: string }[] = [
  { symbol: "US$", code: "USD" },
  { symbol: "CA$", code: "CAD" },
  { symbol: "C$", code: "CAD" },
  { symbol: "AU$", code: "AUD" },
  { symbol: "A$", code: "AUD" },
  { symbol: "S$", code: "SGD" },
  { symbol: "CN¥", code: "CNY" },
  { symbol: "元", code: "CNY" },
  { symbol: "$", code: "USD" },
  { symbol: "€", code: "EUR" },
  { symbol: "£", code: "GBP" },
  { symbol: "¥", code: "JPY" },
  { symbol: "￥", code: "JPY" },
  { symbol: "USD", code: "USD" },
  { symbol: "EUR", code: "EUR" },
  { symbol: "GBP", code: "GBP" },
  { symbol: "CAD", code: "CAD" },
  { symbol: "AUD", code: "AUD" },
  { symbol: "SGD", code: "SGD" },
  { symbol: "JPY", code: "JPY" },
  { symbol: "CNY", code: "CNY" },
];

export const MONTH_NAMES = new Map<string, number>([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12],
]);
