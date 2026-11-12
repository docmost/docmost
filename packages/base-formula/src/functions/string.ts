import { register } from "./registry";
import { valueToString } from "../number";
import type { EvalContext } from "../types";

const s = (v: unknown, ctx: EvalContext): string => valueToString(v, ctx.zone);

function includesLinear(text: string, pattern: string): boolean {
  if (pattern.length <= 64) return text.includes(pattern);
  const fail = new Int32Array(pattern.length);
  for (let i = 1, k = 0; i < pattern.length; i++) {
    while (k > 0 && pattern[i] !== pattern[k]) k = fail[k - 1];
    if (pattern[i] === pattern[k]) k++;
    fail[i] = k;
  }
  for (let i = 0, k = 0; i < text.length; i++) {
    while (k > 0 && text[i] !== pattern[k]) k = fail[k - 1];
    if (text[i] === pattern[k]) k++;
    if (k === pattern.length) return true;
  }
  return false;
}

register({
  name: "concat", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "string",
  eval: (args, ctx) => args.map((a) => s(a, ctx)).join(""),
  doc: "Concatenates strings.", category: "string",
});
register({
  name: "length", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "number",
  eval: ([v], ctx) => s(v, ctx).length,
  doc: "Length of a string.", category: "string",
});
register({
  name: "contains", arity: { min: 2, max: 2 }, paramTypes: ["string", "string"], returnType: "boolean",
  eval: ([a, b], ctx) => includesLinear(s(a, ctx), s(b, ctx)),
  doc: "Returns true if the first string contains the second.", category: "string",
});
register({
  name: "lower", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "string",
  eval: ([v], ctx) => s(v, ctx).toLowerCase(),
  doc: "Lowercases the string.", category: "string",
});
register({
  name: "upper", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "string",
  eval: ([v], ctx) => s(v, ctx).toUpperCase(),
  doc: "Uppercases the string.", category: "string",
});
register({
  name: "trim", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "string",
  eval: ([v], ctx) => s(v, ctx).trim(),
  doc: "Strips whitespace from both ends.", category: "string",
});
