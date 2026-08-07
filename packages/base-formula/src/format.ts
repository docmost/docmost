import type { FormulaAST, OpCode } from "./ast";

const OP_STR: Partial<Record<OpCode, string>> = {
  "+": " + ", "-": " - ", "*": " * ", "/": " / ", "%": " % ",
  "==": " == ", "!=": " != ", ">": " > ", "<": " < ", ">=": " >= ", "<=": " <= ",
};

export function format(
  ast: FormulaAST,
  idToName: ReadonlyMap<string, string>,
): string {
  switch (ast.t) {
    case "num":  return String(ast.v);
    case "str":  return `"${ast.v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    case "bool": return ast.v ? "true" : "false";
    case "null": return "null";
    case "prop": return `prop("${idToName.get(ast.id) ?? ast.id}")`;
    case "op":
      if (ast.op === "neg") return `-${format(ast.args[0], idToName)}`;
      if (ast.op === "not") return `not ${format(ast.args[0], idToName)}`;
      return `(${format(ast.args[0], idToName)}${OP_STR[ast.op]}${format(ast.args[1], idToName)})`;
    case "if":
      return `if(${format(ast.cond, idToName)}, ${format(ast.then, idToName)}, ${format(ast.else, idToName)})`;
    case "and":
      return `(${ast.args.map((a) => format(a, idToName)).join(" and ")})`;
    case "or":
      return `(${ast.args.map((a) => format(a, idToName)).join(" or ")})`;
    case "call":
      return `${ast.fn}(${ast.args.map((a) => format(a, idToName)).join(", ")})`;
  }
}
