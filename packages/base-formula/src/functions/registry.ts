// packages/base-formula/src/functions/registry.ts
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
  if (registry.has(fn.name)) {
    throw new Error(`Duplicate formula function: ${fn.name}`);
  }
  registry.set(fn.name, fn);
}
