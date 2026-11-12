import { makeErrorCell, isErrorCell } from "./error";
import { valueToString, snapNumber } from "./number";
import { isCanonicalInstant, isValidTimeZone, isYmd } from "./date";
import { asDateValue, coerceToResultType, dayOf, isDateValue } from "./date-value";
import { dateKindOfProperty } from "./property";
import { registry } from "./functions/index";
import {
  DEFAULT_MAX_DEPTH,
  MAX_EVAL_DEPTH,
  MAX_EVAL_NODES,
  MAX_EVAL_TEXT_CHARS,
  MAX_TEXT_LENGTH,
} from "./types";
import type { FormulaAST, OpCode } from "./ast";
import type {
  Value,
  EvalContext,
  FormulaCell,
  FormulaTypeOptions,
  PropertyLookup,
} from "./types";

const NO_ARGS: FormulaAST[] = [];

const isRowTimestamp = (d: unknown): boolean =>
  d == null || (d instanceof Date && !isNaN(d.getTime()));

export function createEvalContext(args: {
  properties: ReadonlyMap<string, PropertyLookup>;
  zone: string;
  now: Date;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}): EvalContext {
  if (!isValidTimeZone(args.zone)) {
    throw new Error(`Invalid time zone: ${String(args.zone)}`);
  }
  if (!(args.now instanceof Date) || isNaN(args.now.getTime())) {
    throw new Error("Invalid clock");
  }
  if (!isRowTimestamp(args.createdAt) || !isRowTimestamp(args.updatedAt)) {
    throw new Error("Invalid row timestamp");
  }
  return {
    registry,
    properties: args.properties,
    depth: 0,
    maxDepth: DEFAULT_MAX_DEPTH,
    memo: new Map(),
    path: new Set(),
    nodes: 0,
    textChars: 0,
    zone: args.zone,
    now: args.now,
    today: null,
    createdAt: args.createdAt ?? null,
    updatedAt: args.updatedAt ?? null,
  };
}

export function evaluateCell(
  options: Pick<FormulaTypeOptions, "ast" | "resultType">,
  row: Record<string, unknown>,
  ctx: EvalContext,
): FormulaCell {
  try {
    const v = coerceToResultType(
      evaluate(options.ast, row, ctx),
      options.resultType,
      ctx.zone,
    );
    if (ctx.nodes > MAX_EVAL_NODES || ctx.textChars > MAX_EVAL_TEXT_CHARS) {
      return makeErrorCell("DEPTH_EXCEEDED", "formula too large");
    }
    if (isDateValue(v)) {
      const canonical = v.kind === "date" ? isYmd(v.value) : v.kind === "datetime" && isCanonicalInstant(v.value);
      return canonical ? { start: v.value } : makeErrorCell("DATE_INVALID", "date out of range");
    }
    return typeof v === "number" ? snapNumber(v) : v;
  } catch (e) {
    return makeErrorCell("TYPE_MISMATCH", (e as Error).message);
  }
}

export function evaluate(
  ast: FormulaAST,
  row: Record<string, unknown>,
  ctx: EvalContext,
  astDepth = 0,
): Value {
  // astDepth bounds AST tree-walk recursion (guards a hand-crafted deep
  // typeOptions.ast); ctx.depth separately bounds nested-formula hops.
  const depth = astDepth + 1;
  if (depth > MAX_EVAL_DEPTH) {
    return makeErrorCell("DEPTH_EXCEEDED", `formula too deeply nested (max ${MAX_EVAL_DEPTH})`);
  }
  if (astDepth === 0) {
    ctx.nodes = 0;
    ctx.textChars = 0;
  }
  if (++ctx.nodes > MAX_EVAL_NODES || ctx.textChars > MAX_EVAL_TEXT_CHARS) {
    return makeErrorCell("DEPTH_EXCEEDED", "formula too large");
  }

  let result: Value;
  let produced = false;
  switch (ast?.t) {
    case "num":  return typeof ast.v === "number" && Number.isFinite(ast.v) ? ast.v : null;
    case "str":  result = typeof ast.v === "string" ? ast.v : null; break;
    case "bool": return typeof ast.v === "boolean" ? ast.v : null;
    case "null": return null;
    case "prop": result = evalProp(ast.id, row, ctx, depth); break;
    case "op":   result = evalOp(ast.op, Array.isArray(ast.args) ? ast.args : NO_ARGS, row, ctx, depth); produced = true; break;
    case "if": {
      const c = evaluate(ast.cond, row, ctx, depth);
      if (isErrorCell(c)) return c;
      return evaluate(c === true ? ast.then : ast.else, row, ctx, depth);
    }
    case "and": {
      const xs = Array.isArray(ast.args) ? ast.args : NO_ARGS;
      for (let i = 0; i < xs.length; i++) {
        const v = evaluate(xs[i], row, ctx, depth);
        if (isErrorCell(v)) return v;
        if (v === false) return false;
        if (v == null) return null;
      }
      return true;
    }
    case "or": {
      const xs = Array.isArray(ast.args) ? ast.args : NO_ARGS;
      for (let i = 0; i < xs.length; i++) {
        const v = evaluate(xs[i], row, ctx, depth);
        if (isErrorCell(v)) return v;
        if (v === true) return true;
      }
      return false;
    }
    case "call": {
      const fn = ctx.registry.get(ast.fn.toLowerCase());
      if (!fn) return makeErrorCell("MISSING_PROP", `unknown function ${ast.fn}`);
      const xs = Array.isArray(ast.args) ? ast.args : NO_ARGS;
      const args: Value[] = new Array(xs.length);
      for (let i = 0; i < xs.length; i++) {
        const v = evaluate(xs[i], row, ctx, depth);
        if (isErrorCell(v)) return { ...v, __err: "DEPENDENCY_ERROR" };
        args[i] = v;
      }
      if (overTextBudget(args, ctx)) return makeErrorCell("DEPTH_EXCEEDED", "formula too large");
      try { result = fn.eval(args, ctx); }
      catch (e) { return makeErrorCell("TYPE_MISMATCH", (e as Error).message); }
      produced = true;
      break;
    }
    default:
      return null;
  }
  if (typeof result !== "string") return result;
  if (result.length > MAX_TEXT_LENGTH) return makeErrorCell("TYPE_MISMATCH", "text too long");
  if (produced && (ctx.textChars += result.length) > MAX_EVAL_TEXT_CHARS) {
    return makeErrorCell("DEPTH_EXCEEDED", "formula too large");
  }
  return result;
}

function overTextBudget(operands: Value[], ctx: EvalContext): boolean {
  for (const v of operands) if (typeof v === "string") ctx.textChars += v.length;
  return ctx.textChars > MAX_EVAL_TEXT_CHARS;
}

function evalProp(id: string, row: Record<string, unknown>, ctx: EvalContext, astDepth: number): Value {
  if (ctx.memo.has(id)) return ctx.memo.get(id)!;
  const prop = ctx.properties.get(id);
  if (!prop) return makeErrorCell("MISSING_PROP", `missing property ${id}`);
  if (prop.type === "date") {
    const kind = dateKindOfProperty(prop.type, prop.typeOptions);
    const cell = row[id];
    const start =
      typeof cell === "object" && cell !== null ? (cell as { start?: unknown }).start : null;
    const canonical = kind === "date" ? isYmd : isCanonicalInstant;
    return kind && typeof start === "string" && canonical(start) ? { kind, value: start } : null;
  }
  if (prop.type === "createdAt") return timestampValue(ctx.createdAt);
  if (prop.type === "lastEditedAt") return timestampValue(ctx.updatedAt);
  if (prop.type !== "formula") return normalize(row[id] ?? null);
  // astDepth continues (not reset) across the nested-formula boundary.
  if (ctx.depth >= ctx.maxDepth || ctx.path.has(id)) {
    return makeErrorCell("DEPTH_EXCEEDED", `max depth ${ctx.maxDepth}`);
  }
  const opts: any = prop.typeOptions;
  ctx.depth++;
  ctx.path.add(id);
  let v: Value;
  try {
    v = coerceToResultType(evaluate(opts.ast, row, ctx, astDepth), opts.resultType, ctx.zone);
  } finally {
    ctx.depth--;
    ctx.path.delete(id);
  }
  if (ctx.nodes <= MAX_EVAL_NODES && ctx.textChars <= MAX_EVAL_TEXT_CHARS) ctx.memo.set(id, v);
  return v;
}

function timestampValue(d: Date | null): Value {
  if (!d || isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  return isCanonicalInstant(iso) ? { kind: "datetime", value: iso } : null;
}

function normalize(v: unknown): Value {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (isErrorCell(v)) return v;
  return null;
}

const COMPARISON_OPS: ReadonlySet<OpCode> = new Set(["==", "!=", "<", ">", "<=", ">="]);

function compareDates(op: OpCode, a: Value, b: Value, zone: string): boolean {
  const da = asDateValue(a);
  const db = asDateValue(b);
  if (!da || !db) return op === "!=";
  const sameKind = da.kind === db.kind;
  const x = sameKind ? da.value : dayOf(da, zone);
  const y = sameKind ? db.value : dayOf(db, zone);
  switch (op) {
    case "==": return x === y;
    case "!=": return x !== y;
    case "<":  return x < y;
    case ">":  return x > y;
    case "<=": return x <= y;
    default:   return x >= y;
  }
}

const isTextOperand = (v: Value) => v == null || typeof v === "string" || isDateValue(v);

function joinsAsText(a: Value, b: Value): boolean {
  if (typeof a === "string" || typeof b === "string") return true;
  return (isDateValue(a) || isDateValue(b)) && isTextOperand(a) && isTextOperand(b);
}

function evalOp(
  op: OpCode,
  args: FormulaAST[],
  row: Record<string, unknown>,
  ctx: EvalContext,
  astDepth: number,
): Value {
  const a = evaluate(args[0], row, ctx, astDepth);
  if (isErrorCell(a)) return { ...a, __err: "DEPENDENCY_ERROR" };
  if ((op === "neg" || op === "not") && overTextBudget([a], ctx)) {
    return makeErrorCell("DEPTH_EXCEEDED", "formula too large");
  }
  if (op === "neg") return a == null ? null : -Number(a);
  if (op === "not") return a == null ? null : !Boolean(a);

  const b = evaluate(args[1], row, ctx, astDepth);
  if (isErrorCell(b)) return { ...b, __err: "DEPENDENCY_ERROR" };
  if (overTextBudget([a, b], ctx)) return makeErrorCell("DEPTH_EXCEEDED", "formula too large");

  if (COMPARISON_OPS.has(op) && (isDateValue(a) || isDateValue(b))) {
    return compareDates(op, a, b, ctx.zone);
  }

  switch (op as Exclude<OpCode, "neg" | "not">) {
    case "+":
      if (joinsAsText(a, b)) return valueToString(a, ctx.zone) + valueToString(b, ctx.zone);
      if (a == null || b == null) return null;
      return Number(a) + Number(b);
    case "-": return a == null || b == null ? null : Number(a) - Number(b);
    case "*": return a == null || b == null ? null : Number(a) * Number(b);
    case "/":
      if (a == null || b == null) return null;
      if (Number(b) === 0) return makeErrorCell("DIV_BY_ZERO", "division by zero");
      return Number(a) / Number(b);
    case "%":
      if (a == null || b == null) return null;
      if (Number(b) === 0) return makeErrorCell("DIV_BY_ZERO", "modulo by zero");
      return Number(a) % Number(b);
    case "==": return a === b;
    case "!=": return a !== b;
    case ">":  return a != null && b != null && (a as any) > (b as any);
    case "<":  return a != null && b != null && (a as any) < (b as any);
    case ">=": return a != null && b != null && (a as any) >= (b as any);
    case "<=": return a != null && b != null && (a as any) <= (b as any);
    default:   return null;
  }
}
