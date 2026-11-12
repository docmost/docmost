import { parseRaw } from "./parser";
import { resolve } from "./resolver";
import { typecheck } from "./typecheck";
import { registry } from "./functions/index";
import { resultTypeOfProperty } from "./property";
import type { FormulaTypeOptions } from "./types";

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
  return {
    source,
    ast: resolved.ast,
    resultType,
    dependencies: resolved.dependencies,
    astVersion: 1,
  };
}
