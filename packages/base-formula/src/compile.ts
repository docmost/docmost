import { parseRaw } from "./parser";
import { resolve } from "./resolver";
import { typecheck } from "./typecheck";
import { registry } from "./functions/index";
import { resultTypeOfProperty } from "./property";
import { isErrorCell } from "./error";
import { MAX_EVAL_DEPTH } from "./types";
import type { FormulaAST } from "./ast";
import type { FormulaFn } from "./functions";
import type {
  FormulaResultType,
  FormulaTypeOptions,
  FormulaVolatility,
  PropertyLookup,
} from "./types";

const UNARY_OPS: ReadonlySet<unknown> = new Set(["neg", "not"]);
const BINARY_OPS: ReadonlySet<unknown> = new Set([
  "+", "-", "*", "/", "%", "==", "!=", ">", "<", ">=", "<=",
]);

export type FormulaProperty = {
  id: string;
  name: string;
  type: string;
  typeOptions?: unknown;
};

export function compileFormula(
  source: string,
  properties: ReadonlyArray<FormulaProperty>,
): FormulaTypeOptions {
  const raw = parseRaw(source);
  const resolved = resolve(raw, new Map(properties.map((p) => [p.name, p.id])));
  const typeMap = new Map(
    properties.map((p) => [p.id, resultTypeOfProperty(p.type, p.typeOptions)]),
  );
  const { resultType } = typecheck(resolved.ast, typeMap, registry);
  const lookup = new Map<string, PropertyLookup>(
    properties.map((p) => [
      p.id,
      { id: p.id, type: p.type, typeOptions: p.typeOptions },
    ]),
  );
  return {
    source,
    ast: resolved.ast,
    resultType,
    dependencies: resolved.dependencies,
    astVersion: 1,
    volatile: volatilityOf(resolved.ast, lookup, registry),
  };
}

export function volatilityOf(
  ast: FormulaAST,
  properties: ReadonlyMap<string, PropertyLookup>,
  registry: ReadonlyMap<string, FormulaFn>,
): FormulaVolatility {
  let found: FormulaVolatility = null;
  const expanded = new Set<string>();
  const stack: unknown[] = [ast];
  while (stack.length > 0) {
    const node = stack.pop() as any;
    if (typeof node !== "object" || node === null) continue;
    if (node.t === "call") {
      const fn =
        typeof node.fn === "string" ? registry.get(node.fn.toLowerCase()) : undefined;
      if (fn?.volatile === "now") return "now";
      if (fn?.volatile === "today") found = "today";
    }
    if (node.t === "prop") {
      const dep = properties.get(node.id);
      if (dep?.type === "formula" && !expanded.has(node.id)) {
        expanded.add(node.id);
        stack.push((dep.typeOptions as { ast?: unknown } | null)?.ast);
      }
    }
    if (Array.isArray(node.args)) {
      for (const arg of node.args) stack.push(arg);
    }
    if (node.t === "if") stack.push(node.cond, node.then, node.else);
  }
  return found;
}

export function deriveFormulaOptions(
  ast: unknown,
  properties: ReadonlyArray<FormulaProperty>,
): { resultType: FormulaResultType; dependencies: string[]; volatile: FormulaVolatility } | null {
  const ids = new Set(properties.map((p) => p.id));
  const dependencies = new Set<string>();
  const nodes: unknown[] = [ast];
  const depths: number[] = [1];
  while (nodes.length > 0) {
    const node = nodes.pop() as any;
    const depth = depths.pop();
    if (depth > MAX_EVAL_DEPTH || typeof node !== "object" || node === null) return null;
    let children: unknown[];
    switch (node.t) {
      case "num":
        if (typeof node.v !== "number" || !Number.isFinite(node.v)) return null;
        continue;
      case "str":
        if (typeof node.v !== "string") return null;
        continue;
      case "bool":
        if (typeof node.v !== "boolean") return null;
        continue;
      case "null":
        continue;
      case "prop":
        if (typeof node.id !== "string" || !ids.has(node.id)) return null;
        dependencies.add(node.id);
        continue;
      case "if":
        children = [node.cond, node.then, node.else];
        break;
      case "and":
      case "or":
        if (!Array.isArray(node.args)) return null;
        children = node.args;
        break;
      case "op": {
        const arity = UNARY_OPS.has(node.op) ? 1 : BINARY_OPS.has(node.op) ? 2 : -1;
        if (!Array.isArray(node.args) || node.args.length !== arity) return null;
        children = node.args;
        break;
      }
      case "call": {
        const fn = typeof node.fn === "string" ? registry.get(node.fn.toLowerCase()) : undefined;
        if (!fn || !Array.isArray(node.args)) return null;
        const n = node.args.length;
        if (n < fn.arity.min || (fn.arity.max != null && n > fn.arity.max)) return null;
        children = node.args;
        break;
      }
      default:
        return null;
    }
    for (const child of children) {
      nodes.push(child);
      depths.push(depth + 1);
    }
  }
  const typeMap = new Map(
    properties.map((p) => [p.id, resultTypeOfProperty(p.type, p.typeOptions)]),
  );
  let resultType: FormulaResultType;
  try {
    resultType = typecheck(ast as FormulaAST, typeMap, registry).resultType;
  } catch {
    return null;
  }
  const lookup = new Map<string, PropertyLookup>(
    properties.map((p) => [
      p.id,
      { id: p.id, type: p.type, typeOptions: p.typeOptions },
    ]),
  );
  return {
    resultType,
    dependencies: Array.from(dependencies).sort(),
    volatile: volatilityOf(ast as FormulaAST, lookup, registry),
  };
}

export function formulaCellsEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === "number" && typeof b === "number") {
    return a === b || (Number.isNaN(a) && Number.isNaN(b));
  }
  if (typeof a !== "object" || typeof b !== "object") return a === b;
  if (isErrorCell(a) || isErrorCell(b)) {
    return isErrorCell(a) && isErrorCell(b) && a.__err === b.__err && a.msg === b.msg;
  }
  const x = a as { start?: unknown; end?: unknown };
  const y = b as { start?: unknown; end?: unknown };
  return typeof x.start === "string" && x.start === y.start && x.end === y.end;
}
