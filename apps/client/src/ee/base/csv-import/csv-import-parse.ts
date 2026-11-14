import Papa from "papaparse";
import {
  addColumnValue,
  createColumnStats,
  finalizeColumnProfile,
  type CsvColumnStats,
} from "@/ee/base/csv-import/csv-column-profile";
import { convertCsvValue } from "@/ee/base/csv-import/csv-import-convert";
import { stripFormulaApostrophe } from "@/ee/base/csv-import/csv-value-parsers";
import {
  PREVIEW_CELL_MAX_LENGTH,
  PREVIEW_ROW_COUNT,
} from "@/ee/base/csv-import/csv-import.constants";
import type {
  CsvConvertColumn,
  CsvDelimiter,
  CsvLoadResult,
} from "@/ee/base/csv-import/csv-import.types";

const DELIMITERS: CsvDelimiter[] = [",", ";", "\t", "|"];
const OUTPUT_PART_SIZE = 1_000_000;
const LINE_SEPARATORS = /[\u2028\u2029]/g;

const escapeLineSeparator = (char: string) => `\\u${char.charCodeAt(0).toString(16)}`;

export type CsvParseOptions = {
  delimiter: CsvDelimiter | null;
  hasHeader: boolean;
};

export type CsvTextProfile = Omit<CsvLoadResult, "encoding">;

export type CsvTextConversion = {
  parts: string[];
  rowCount: number;
  skippedValues: number;
};

export function parseCsvRows(
  text: string,
  delimiter: CsvDelimiter | null,
  onRow: (row: string[], cursor: number) => void,
): CsvDelimiter {
  let detected: CsvDelimiter = delimiter ?? ",";
  Papa.parse<string[]>(text, {
    delimiter: delimiter ?? "",
    delimitersToGuess: DELIMITERS,
    skipEmptyLines: "greedy",
    step: (results) => {
      if (DELIMITERS.includes(results.meta.delimiter as CsvDelimiter)) {
        detected = results.meta.delimiter as CsvDelimiter;
      }
      onRow(results.data, results.meta.cursor);
    },
  });
  return detected;
}

export function profileCsvText(
  text: string,
  options: CsvParseOptions,
  locale: string,
  onProgress?: (cursor: number) => void,
): CsvTextProfile {
  const state: { headers: string[] | null } = { headers: null };
  const stats: CsvColumnStats[] = [];
  const previewRows: string[][] = [];
  let rowCount = 0;
  let widest = 0;

  const delimiter = parseCsvRows(text, options.delimiter, (row, cursor) => {
    if (options.hasHeader && state.headers === null) {
      state.headers = row.map((value) => stripFormulaApostrophe(value.trim()));
      return;
    }
    rowCount++;
    widest = Math.max(widest, row.length);
    const width = state.headers ? state.headers.length : row.length;
    for (let i = 0; i < width; i++) {
      stats[i] ??= createColumnStats();
      addColumnValue(stats[i], row[i]);
    }
    if (previewRows.length < PREVIEW_ROW_COUNT) {
      previewRows.push(row.map((value) => value.slice(0, PREVIEW_CELL_MAX_LENGTH)));
    }
    onProgress?.(cursor);
  });

  const headers = state.headers;
  const columnCount = headers ? headers.length : widest;
  const finalHeaders = Array.from({ length: columnCount }, (_, i) => headers?.[i] ?? "");
  const profiles = finalHeaders.map((header, i) =>
    finalizeColumnProfile(stats[i] ?? createColumnStats(), header, locale),
  );

  return { headers: finalHeaders, previewRows, rowCount, delimiter, profiles };
}

// rows whose chosen columns are all empty are left out, along with their unreadable values
export function convertCsvText(
  text: string,
  options: { delimiter: CsvDelimiter; hasHeader: boolean },
  columns: CsvConvertColumn[],
  onProgress?: (processedRows: number) => void,
): CsvTextConversion {
  const parts: string[] = [];
  let buffer = "";
  let headerSeen = !options.hasHeader;
  let processed = 0;
  let rowCount = 0;
  let skippedValues = 0;

  parseCsvRows(text, options.delimiter, (row) => {
    if (!headerSeen) {
      headerSeen = true;
      return;
    }
    processed++;
    let hasValue = false;
    let rowSkipped = 0;
    const values = columns.map((column) => {
      const result = convertCsvValue(row[column.index], column.type, column.hints);
      rowSkipped += result.skipped ?? (result.status === "invalid" ? 1 : 0);
      if (result.value !== null) hasValue = true;
      return result.value;
    });
    if (hasValue) {
      // JSON.stringify leaves these raw, and some line readers split on them
      buffer += JSON.stringify(values).replace(LINE_SEPARATORS, escapeLineSeparator) + "\n";
      rowCount++;
      skippedValues += rowSkipped;
      if (buffer.length > OUTPUT_PART_SIZE) {
        parts.push(buffer);
        buffer = "";
      }
    }
    onProgress?.(processed);
  });
  if (buffer) parts.push(buffer);

  return { parts, rowCount, skippedValues };
}
