import { makeErrorCell, isErrorCell } from "./error";
import { valueToString } from "./number";
import { MAX_EVAL_DEPTH } from "./types";
import type { FormulaAST, OpCode } from "./ast";
import type { Value, EvalContext } from "./types";

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
  if (prop.type !== "formula") return normalize(row[id] ?? null);
  // astDepth continues (not reset) across the nested-formula boundary.
  if (ctx.depth >= ctx.maxDepth) return makeErrorCell("DEPTH_EXCEEDED", `max depth ${ctx.maxDepth}`);
  const opts: any = prop.typeOptions;
  const nested: EvalContext = { ...ctx, depth: ctx.depth + 1, memo: ctx.memo };
  const v = evaluate(opts.ast, row, nested, astDepth);
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
  astDepth: number,
): Value {
  const a = evaluate(args[0], row, ctx, astDepth);
  if (isErrorCell(a)) return { ...a, __err: "DEPENDENCY_ERROR" };
  if (op === "neg") return a == null ? null : -Number(a);
  if (op === "not") return a == null ? null : !Boolean(a);

  const b = evaluate(args[1], row, ctx, astDepth);
  if (isErrorCell(b)) return { ...b, __err: "DEPENDENCY_ERROR" };

  switch (op as Exclude<OpCode, "neg" | "not">) {
    case "+":
      if (typeof a === "string" || typeof b === "string") return valueToString(a) + valueToString(b);
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
