// packages/base-formula/src/eval.ts
import { makeErrorCell, isErrorCell } from "./error";
import type { FormulaAST, OpCode } from "./ast";
import type { Value, EvalContext } from "./types";

export function evaluate(
  ast: FormulaAST,
  row: Record<string, unknown>,
  ctx: EvalContext,
): Value {
  switch (ast.t) {
    case "num":  return ast.v;
    case "str":  return ast.v;
    case "bool": return ast.v;
    case "null": return null;
    case "prop": return evalProp(ast.id, row, ctx);
    case "op":   return evalOp(ast.op, ast.args, row, ctx);
    case "if": {
      const c = evaluate(ast.cond, row, ctx);
      if (isErrorCell(c)) return c;
      return evaluate(c === true ? ast.then : ast.else, row, ctx);
    }
    case "and": {
      for (const a of ast.args) {
        const v = evaluate(a, row, ctx);
        if (isErrorCell(v)) return v;
        if (v === false) return false;
        if (v == null) return null;
      }
      return true;
    }
    case "or": {
      for (const a of ast.args) {
        const v = evaluate(a, row, ctx);
        if (isErrorCell(v)) return v;
        if (v === true) return true;
      }
      return false;
    }
    case "call": {
      const fn = ctx.registry.get(ast.fn);
      if (!fn) return makeErrorCell("MISSING_PROP", `unknown function ${ast.fn}`);
      const args = ast.args.map((a) => evaluate(a, row, ctx));
      for (const v of args) if (isErrorCell(v)) return { ...v, __err: "DEPENDENCY_ERROR" };
      try { return fn.eval(args, ctx); }
      catch (e) { return makeErrorCell("TYPE_MISMATCH", (e as Error).message); }
    }
  }
}

function evalProp(id: string, row: Record<string, unknown>, ctx: EvalContext): Value {
  if (ctx.memo.has(id)) return ctx.memo.get(id)!;
  const prop = ctx.properties.get(id);
  if (!prop) return makeErrorCell("MISSING_PROP", `missing property ${id}`);
  if (prop.type !== "formula") return normalize(row[id] ?? null);
  // Nested formula: recurse with depth tracking.
  if (ctx.depth >= ctx.maxDepth) return makeErrorCell("DEPTH_EXCEEDED", `max depth ${ctx.maxDepth}`);
  const opts: any = prop.typeOptions;
  const nested: EvalContext = { ...ctx, depth: ctx.depth + 1, memo: ctx.memo };
  const v = evaluate(opts.ast, row, nested);
  ctx.memo.set(id, v);
  return v;
}

function normalize(v: unknown): Value {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (isErrorCell(v)) return v;
  return null;
}

function evalOp(
  op: OpCode,
  args: FormulaAST[],
  row: Record<string, unknown>,
  ctx: EvalContext,
): Value {
  const vs = args.map((a) => evaluate(a, row, ctx));
  for (const v of vs) if (isErrorCell(v)) return { ...v, __err: "DEPENDENCY_ERROR" };
  const [a, b] = vs;
  switch (op) {
    case "+":
      if (typeof a === "string" || typeof b === "string") return (a == null ? "" : String(a)) + (b == null ? "" : String(b));
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
    case "neg": return a == null ? null : -Number(a);
    case "not": return a == null ? null : !Boolean(a);
  }
}
