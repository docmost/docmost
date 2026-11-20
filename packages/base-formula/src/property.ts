import type { DateKind } from "./date";
import type { FormulaResultType } from "./types";

const RESULT_TYPES: ReadonlySet<string> = new Set<FormulaResultType>([
  "number",
  "string",
  "boolean",
  "date",
  "datetime",
  "null",
]);

function optionsOf(typeOptions: unknown): Record<string, unknown> {
  return typeOptions !== null && typeof typeOptions === "object"
    ? (typeOptions as Record<string, unknown>)
    : {};
}

export function dateKindOfProperty(
  type: string,
  typeOptions: unknown,
): DateKind | null {
  switch (type) {
    case "date":
      return optionsOf(typeOptions).includeTime === true ? "datetime" : "date";
    case "createdAt":
    case "lastEditedAt":
      return "datetime";
    case "formula": {
      const resultType = optionsOf(typeOptions).resultType;
      return resultType === "date" || resultType === "datetime"
        ? resultType
        : null;
    }
    default:
      return null;
  }
}

export function resultTypeOfProperty(
  type: string,
  typeOptions: unknown,
): FormulaResultType {
  const kind = dateKindOfProperty(type, typeOptions);
  if (kind) return kind;
  switch (type) {
    case "formula": {
      const resultType = optionsOf(typeOptions).resultType;
      return typeof resultType === "string" && RESULT_TYPES.has(resultType)
        ? (resultType as FormulaResultType)
        : "null";
    }
    case "number":
      return "number";
    case "text":
    case "longText":
    case "url":
    case "email":
      return "string";
    case "checkbox":
      return "boolean";
    default:
      return "null";
  }
}
