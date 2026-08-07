import type { ErrorCell, ErrorCode } from "./types";

export type ParseErrorCode =
  | "UNEXPECTED_TOKEN"
  | "UNEXPECTED_EOF"
  | "UNKNOWN_PROPERTY"
  | "UNKNOWN_FUNCTION"
  | "ARITY_MISMATCH"
  | "TYPE_MISMATCH"
  | "CYCLE"
  | "INPUT_TOO_LONG"
  | "DEPTH_EXCEEDED";

export type ParseError = {
  code: ParseErrorCode;
  message: string;
  span: { start: number; end: number };
  hint?: string;
};

export class FormulaParseError extends Error {
  readonly errors: ParseError[];
  constructor(errors: ParseError[]) {
    super(errors.map((e) => `${e.code}: ${e.message}`).join("; "));
    this.errors = errors;
    this.name = "FormulaParseError";
  }
}

export function makeErrorCell(code: ErrorCode, msg: string): ErrorCell {
  return { __err: code, msg, v: 1 };
}

export function isErrorCell(v: unknown): v is ErrorCell {
  return (
    typeof v === "object" &&
    v !== null &&
    "__err" in v &&
    typeof (v as { __err: unknown }).__err === "string"
  );
}
