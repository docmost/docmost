import { makeErrorCell, isErrorCell } from "./error";
import { valueToString, snapNumber } from "./number";
import { isValidTimeZone } from "./date";
import { asDateValue, coerceToResultType, dayOf, isDateValue } from "./date-value";
import { registry } from "./functions/index";
import { DEFAULT_MAX_DEPTH, MAX_EVAL_DEPTH } from "./types";
import type { FormulaAST, OpCode } from "./ast";
import type {
  Value,
  EvalContext,
  FormulaCell,
  FormulaTypeOptions,
  PropertyLookup,
} from "./types";

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
  return {
    registry,
    properties: args.properties,
    depth: 0,
    maxDepth: DEFAULT_MAX_DEPTH,
    memo: new Map(),
    zone: args.zone,
    now: args.now,
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
    if (isDateValue(v)) return { start: v.value };
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

  switch (ast.t) {
    case "num":  return ast.v;
    case "str":  return ast.v;
    case "bool": return ast.v;
    case "null": return null;
    case "prop": return evalProp(ast.id, row, ctx, depth);
    case "op":   return evalOp(ast.op, ast.args, row, ctx, depth);
    case "if": {
      const c = evaluate(ast.cond, row, ctx, depth);
      if (isErrorCell(c)) return c;
      return evaluate(c === true ? ast.then : ast.else, row, ctx, depth);
    }
    case "and": {
      const xs = ast.args;
      for (let i = 0; i < xs.length; i++) {
        const v = evaluate(xs[i], row, ctx, depth);
        if (isErrorCell(v)) return v;
        if (v === false) return false;
        if (v == null) return null;
      }
      return true;
    }
    case "or": {
      const xs = ast.args;
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
      const xs = ast.args;
      const args: Value[] = new Array(xs.length);
      for (let i = 0; i < xs.length; i++) {
        const v = evaluate(xs[i], row, ctx, depth);
        if (isErrorCell(v)) return { ...v, __err: "DEPENDENCY_ERROR" };
        args[i] = v;
      }
      try { return fn.eval(args, ctx); }
      catch (e) { return makeErrorCell("TYPE_MISMATCH", (e as Error).message); }
    }
  }
}

function evalProp(id: string, row: Record<string, unknown>, ctx: EvalContext, astDepth: number): Value {
  if (ctx.memo.has(id)) return ctx.memo.get(id)!;
  const prop = ctx.properties.get(id);
  if (!prop) return makeErrorCell("MISSING_PROP", `missing property ${id}`);
  if (prop.type === "date") return dateCellToFormulaValue(row[id] ?? null);
  if (prop.type !== "formula") return normalize(row[id] ?? null);
  // astDepth continues (not reset) across the nested-formula boundary.
  if (ctx.depth >= ctx.maxDepth) return makeErrorCell("DEPTH_EXCEEDED", `max depth ${ctx.maxDepth}`);
  const opts: any = prop.typeOptions;
  const nested: EvalContext = { ...ctx, depth: ctx.depth + 1, memo: ctx.memo };
  const v = evaluate(opts.ast, row, nested, astDepth);
  ctx.memo.set(id, v);
  return v;
}

const YMD_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function isRealYmdPrefix(s: string): boolean {
  const m = YMD_PREFIX_RE.exec(s);
  if (!m) return false;
  const probe = new Date(0);
  probe.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return (
    probe.getUTCFullYear() === Number(m[1]) &&
    probe.getUTCMonth() === Number(m[2]) - 1 &&
    probe.getUTCDate() === Number(m[3])
  );
}

function dateCellToFormulaValue(cell: unknown): Value {
  const start =
    typeof cell === "object" && cell !== null ? (cell as { start?: unknown }).start : cell;
  if (typeof start !== "string" || !isRealYmdPrefix(start)) return null;
  if (DATE_ONLY_RE.test(start)) return `${start}T00:00:00.000Z`;
  return INSTANT_RE.test(start) && !isNaN(Date.parse(start)) ? start : null;
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

function evalOp(
  op: OpCode,
  args: FormulaAST[],
  row: Record<string, unknown>,
  ctx: EvalContext,
  astDepth: number,
): Value {
  const a = evaluate(args[0], row, ctx, astDepth);
  if (isErrorCell(a)) return { ...a, __err: "DEPENDENCY_ERROR" };
  if (op === "neg") return a == null ? null : -Number(a);
  if (op === "not") return a == null ? null : !Boolean(a);

  const b = evaluate(args[1], row, ctx, astDepth);
  if (isErrorCell(b)) return { ...b, __err: "DEPENDENCY_ERROR" };

  if (COMPARISON_OPS.has(op) && (isDateValue(a) || isDateValue(b))) {
    return compareDates(op, a, b, ctx.zone);
  }

  switch (op as Exclude<OpCode, "neg" | "not">) {
    case "+":
      if (typeof a === "string" || typeof b === "string") return valueToString(a, ctx.zone) + valueToString(b, ctx.zone);
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
  }
}
