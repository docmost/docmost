import type { FormulaAST } from "./ast";

export type FormulaResultType =
  | "number"
  | "string"
  | "boolean"
  | "date"
  | "null";

export type FormulaTypeOptions = {
  source: string;
  ast: FormulaAST;
  resultType: FormulaResultType;
  dependencies: string[];
  astVersion: 1;
  formatOptions?: Record<string, unknown>;
};

/*
 * The runtime value produced by evaluating a node. Strings and numbers are
 * their JS equivalents; dates are ISO 8601 UTC strings (matches how the date
 * property type already stores cells); booleans are booleans; missing or
 * filtered-out values are null. Errors are distinguishable from all valid
 * values because they are objects with a `__err` key.
 */
export type Value = number | string | boolean | null | ErrorCell;

export type ErrorCell = {
  __err: ErrorCode;
  msg: string;
  v: 1;
};

export type ErrorCode =
  | "MISSING_PROP"
  | "TYPE_MISMATCH"
  | "DIV_BY_ZERO"
  | "DATE_INVALID"
  | "DEPTH_EXCEEDED"
  | "DEPENDENCY_ERROR";

/*
 * EvalContext carries everything the evaluator needs that isn't in the AST:
 * the function registry (server-only), the property map for resolving `prop`
 * nodes to their formula ASTs when nested, and the current recursion depth.
 */
export type EvalContext = {
  registry: ReadonlyMap<string, import("./functions/registry").FormulaFn>;
  properties: ReadonlyMap<string, PropertyLookup>;
  depth: number;
  maxDepth: number;
  memo: Map<string, Value>; // keyed by propId for the current row-eval
};

export type PropertyLookup = {
  id: string;
  type: string;
  typeOptions: unknown;
};

export const DEFAULT_MAX_DEPTH = 64;

/*
 * DoS guards. A formula source longer than MAX_FORMULA_SOURCE_LENGTH is
 * rejected before tokenizing (cheap backstop against pathological input like
 * "(".repeat(50000)). MAX_PARSE_DEPTH bounds recursive-descent nesting so a
 * deeply nested source throws a catchable FormulaParseError instead of
 * overflowing the JS stack with a RangeError. MAX_EVAL_DEPTH bounds the
 * tree-walking evaluator so an oversized AST that slipped past the parser
 * degrades to an error cell instead of crashing the recompute worker.
 */
export const MAX_FORMULA_SOURCE_LENGTH = 10_000;
export const MAX_PARSE_DEPTH = 256;
export const MAX_EVAL_DEPTH = 512;
