import { parseRaw } from "./parser";
import { resolve } from "./resolver";
import { typecheck } from "./typecheck";
import { registry } from "./functions/index";
import { resultTypeOfProperty } from "./property";
import type { FormulaAST } from "./ast";
import type { FormulaFn } from "./functions";
import type {
  FormulaTypeOptions,
  FormulaVolatility,
  PropertyLookup,
} from "./types";

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
    if (Array.isArray(node.args)) stack.push(...node.args);
    if (node.t === "if") stack.push(node.cond, node.then, node.else);
  }
  return found;
}
