import type { FormulaResultType, Value, EvalContext } from "../types";

export type FormulaFn = {
  name: string;
  arity: { min: number; max: number | null };
  paramTypes: FormulaResultType[] | "any" | "variadic-any";
  returnType: FormulaResultType | ((argTypes: FormulaResultType[]) => FormulaResultType);
  eval: (args: Value[], ctx: EvalContext) => Value;
  doc: string;
  category: "logic" | "math" | "string" | "date" | "coercion";
};

export const registry: Map<string, FormulaFn> = new Map();

export function register(fn: FormulaFn): void {
  // Functions are looked up case-insensitively (see eval/typecheck), so the
  // registry is keyed by the lowercased name. fn.name keeps its canonical
  // casing for display in the function picker and `format()`.
  const key = fn.name.toLowerCase();
  if (registry.has(key)) {
    throw new Error(`Duplicate formula function: ${fn.name}`);
  }
  registry.set(key, fn);
}
