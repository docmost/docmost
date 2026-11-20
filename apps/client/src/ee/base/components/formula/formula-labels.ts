import type { FormulaFn, FormulaResultType } from "@docmost/base-formula/client";

export const RESULT_TYPE_LABELS: Record<FormulaResultType, string> = {
  number: "Number",
  string: "Text",
  boolean: "Checkbox",
  date: "Date",
  datetime: "Date and time",
  null: "Unknown",
};

export function formulaSignature(
  fn: Pick<FormulaFn, "name" | "arity" | "paramTypes">,
  label: (type: FormulaResultType | "any") => string,
): string {
  const { min, max } = fn.arity;
  const optional = (index: number) => (index >= min ? "?" : "");
  let params: string[];
  if (fn.paramTypes === "variadic-any") {
    params = [label("any"), "..."];
  } else if (fn.paramTypes === "any") {
    params = Array.from({ length: max ?? min }, (_, i) => label("any") + optional(i));
  } else {
    params = fn.paramTypes.map((type, i) => label(type) + optional(i));
  }
  return `${fn.name}(${params.join(", ")})`;
}
