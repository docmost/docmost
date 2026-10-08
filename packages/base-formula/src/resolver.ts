import { FormulaParseError } from "./error";
import type { FormulaAST, RawFormulaAST } from "./ast";

export type ResolveResult = {
  ast: FormulaAST;
  dependencies: string[];
};

export function resolve(
  raw: RawFormulaAST,
  nameToId: ReadonlyMap<string, string>,
): ResolveResult {
  const deps = new Set<string>();
  const ast = walk(raw, nameToId, deps);
  return { ast, dependencies: Array.from(deps).sort() };
}

function walk(
  node: RawFormulaAST,
  nameToId: ReadonlyMap<string, string>,
  deps: Set<string>,
): FormulaAST {
  switch (node.t) {
    case "num": case "str": case "bool": case "null":
      return node as FormulaAST;
    case "propName": {
      const id = nameToId.get(node.name);
      if (!id) {
        throw new FormulaParseError([{
          code: "UNKNOWN_PROPERTY",
          message: `Unknown property '${node.name}'`,
          span: { start: 0, end: 0 }, // parser carries real spans; resolver is post-parse
        }]);
      }
      deps.add(id);
      return { t: "prop", id };
    }
    case "op":
      return {
        t: "op",
        op: (node as any).op,
        args: (node as any).args.map((a: RawFormulaAST) => walk(a, nameToId, deps)),
      };
    case "if":
      return {
        t: "if",
        cond: walk((node as any).cond, nameToId, deps),
        then: walk((node as any).then, nameToId, deps),
        else: walk((node as any).else, nameToId, deps),
      };
    case "and":
      return {
        t: "and",
        args: (node as any).args.map((a: RawFormulaAST) => walk(a, nameToId, deps)),
      };
    case "or":
      return {
        t: "or",
        args: (node as any).args.map((a: RawFormulaAST) => walk(a, nameToId, deps)),
      };
    case "call":
      return {
        t: "call",
        fn: (node as any).fn,
        args: (node as any).args.map((a: RawFormulaAST) => walk(a, nameToId, deps)),
      };
  }
}
