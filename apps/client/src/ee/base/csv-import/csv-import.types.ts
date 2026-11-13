import type { BasePropertyType } from "@/ee/base/types/base.types";

export type CsvImportPropertyType = Extract<
  BasePropertyType,
  | "text"
  | "longText"
  | "number"
  | "select"
  | "status"
  | "multiSelect"
  | "date"
  | "person"
  | "checkbox"
  | "url"
  | "email"
>;

export type CsvDelimiter = "," | ";" | "\t" | "|";
export type CsvDateOrder = "MDY" | "DMY";
export type CsvDecimalSeparator = "." | ",";
export type CsvListSeparator = "," | ";";

export type CsvParseHints = {
  dateOrder: CsvDateOrder;
  decimalSeparator: CsvDecimalSeparator;
  listSeparator: CsvListSeparator;
};

export type CsvTypeSuggestion = {
  type: CsvImportPropertyType;
  typeOptions?: Record<string, unknown>;
};

export type CsvColumnProfile = {
  nonEmpty: number;
  samples: string[];
  distinctCount: number;
  // distinct list items with the chosen list separator
  distinctTokenCount: number;
  hasMultipleValues: boolean;
  hints: CsvParseHints;
  suggestion: CsvTypeSuggestion;
  // values per target type that would be left empty (or shortened, for text types)
  issues: Partial<Record<CsvImportPropertyType, number>>;
};

export type CsvImportValue = string | number | boolean | string[] | null;

export type CsvConvertStatus = "ok" | "empty" | "invalid" | "truncated";

export type CsvConvertResult = {
  value: CsvImportValue;
  status: CsvConvertStatus;
  // list items left out of a multi-select cell
  skipped?: number;
};

export type CsvConvertColumn = {
  index: number;
  type: CsvImportPropertyType;
  hints: CsvParseHints;
};

export type CsvColumnTarget =
  | { kind: "existing"; propertyId: string }
  | { kind: "new"; type: CsvImportPropertyType };

export type CsvColumnPlan = {
  index: number;
  header: string;
  include: boolean;
  name: string;
  target: CsvColumnTarget;
  hints: CsvParseHints;
  typeOptions?: Record<string, unknown>;
};

export type BaseCsvImportSpecColumn =
  | { propertyId: string }
  | {
      name: string;
      type: CsvImportPropertyType;
      typeOptions?: Record<string, unknown>;
    };

export type BaseCsvImportSpec = {
  fileName: string;
  rowCount: number;
  columns: BaseCsvImportSpecColumn[];
};

export type BaseImportProgress = {
  fileTaskId: string;
  processedRows: number;
  totalRows: number;
};

export type BaseImportResult = {
  fileTaskId: string;
  status: "success" | "failed";
  importedRows: number;
  skippedValues: number;
  error: string | null;
};

export type CsvLoadOptions = {
  encoding: string | null;
  delimiter: CsvDelimiter | null;
  hasHeader: boolean;
};

export type CsvLoadResult = {
  headers: string[];
  previewRows: string[][];
  rowCount: number;
  delimiter: CsvDelimiter;
  encoding: string;
  profiles: CsvColumnProfile[];
};

export type CsvConvertOutput = {
  blob: Blob;
  rowCount: number;
  skippedValues: number;
};

export type CsvWorkerRequest = { id: number } & (
  | ({ type: "load"; file: File; locale: string } & CsvLoadOptions)
  | { type: "convert"; columns: CsvConvertColumn[] }
);

export type CsvWorkerProgress = {
  phase: "reading" | "converting";
  processed: number;
  total: number;
};

export type CsvWorkerResponse = { id: number } & (
  | ({ type: "loaded" } & CsvLoadResult)
  | ({ type: "converted" } & CsvConvertOutput)
  | ({ type: "progress" } & CsvWorkerProgress)
  | { type: "error"; message: string }
);
