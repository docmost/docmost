import { FormulaParseError } from "./error";
import type { FormulaAST, OpCode } from "./ast";
import type { FormulaResultType } from "./types";
import type { FormulaFn } from "./functions";

export type PropertyTypeMap = ReadonlyMap<string, FormulaResultType>;

export type TypecheckResult = { resultType: FormulaResultType };

const ARITH_OPS: OpCode[] = ["+", "-", "*", "/", "%"];
const CMP_OPS:   OpCode[] = ["==", "!=", ">", "<", ">=", "<="];

export function typecheck(
  ast: FormulaAST,
  propertyTypes: PropertyTypeMap,
  registry: ReadonlyMap<string, FormulaFn>,
): TypecheckResult {
  return { resultType: infer(ast, propertyTypes, registry) };
}

function infer(
  ast: FormulaAST,
  propertyTypes: PropertyTypeMap,
  registry: ReadonlyMap<string, FormulaFn>,
): FormulaResultType {
  switch (ast.t) {
    case "num":  return "number";
    case "str":  return "string";
    case "bool": return "boolean";
    case "null": return "null";
    case "prop": return propertyTypes.get(ast.id) ?? "null";
    case "op": {
      const argTypes = ast.args.map((a) => infer(a, propertyTypes, registry));
      if (ARITH_OPS.includes(ast.op)) {
        // '+' is overloaded to match the evaluator: any string operand makes
        // it string concatenation; otherwise it's numeric addition.
        if (ast.op === "+" && argTypes.some((t) => t === "string")) return "string";
        const allow = argTypes.every((t) => t === "number" || t === "null");
        if (!allow) throw typeErr(`Operator '${ast.op}' needs numbers`);
        return "number";
      }
      if (CMP_OPS.includes(ast.op)) return "boolean";
      if (ast.op === "neg") {
        if (argTypes[0] !== "number" && argTypes[0] !== "null") throw typeErr("Unary '-' needs number");
        return "number";
      }
      if (ast.op === "not") {
        if (argTypes[0] !== "boolean" && argTypes[0] !== "null") throw typeErr("'not' needs boolean");
        return "boolean";
      }
      return "null";
    }
    case "if": {
      const thenT = infer(ast.then, propertyTypes, registry);
      const elseT = infer(ast.else, propertyTypes, registry);
      if (thenT === elseT) return thenT;
      if (thenT === "null") return elseT;
      if (elseT === "null") return thenT;
      throw typeErr(`if() branches have different types: ${thenT} vs ${elseT}`);
    }
    case "and": case "or":
      ast.args.forEach((a) => {
        const t = infer(a, propertyTypes, registry);
        if (t !== "boolean" && t !== "null") throw typeErr(`'${ast.t}' needs boolean args`);
      });
      return "boolean";
    case "call": {
      const fn = registry.get(ast.fn.toLowerCase());
      if (!fn) throw new FormulaParseError([{
        code: "UNKNOWN_FUNCTION",
        message: `Unknown function '${ast.fn}'`,
        span: { start: 0, end: 0 },
      }]);
      const argTypes = ast.args.map((a) => infer(a, propertyTypes, registry));
      if (argTypes.length < fn.arity.min || (fn.arity.max != null && argTypes.length > fn.arity.max)) {
        throw new FormulaParseError([{
          code: "ARITY_MISMATCH",
          message: `${fn.name}() expects ${fn.arity.min}-${fn.arity.max ?? "∞"} args, got ${argTypes.length}`,
          span: { start: 0, end: 0 },
        }]);
      }
      return typeof fn.returnType === "function" ? fn.returnType(argTypes) : fn.returnType;
    }
  }
}

function typeErr(message: string): FormulaParseError {
  return new FormulaParseError([{ code: "TYPE_MISMATCH", message, span: { start: 0, end: 0 } }]);
}
