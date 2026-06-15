import { register } from "./registry";
import { valueToString } from "../number";

const s = (v: unknown): string => valueToString(v);

register({
  name: "concat", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "string",
  eval: (args) => args.map(s).join(""),
  doc: "Concatenates strings.", category: "string",
});
register({
  name: "length", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "number",
  eval: ([v]) => s(v).length,
  doc: "Length of a string.", category: "string",
});
register({
  name: "contains", arity: { min: 2, max: 2 }, paramTypes: ["string", "string"], returnType: "boolean",
  eval: ([a, b]) => s(a).includes(s(b)),
  doc: "Returns true if the first string contains the second.", category: "string",
});
register({
  name: "lower", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "string",
  eval: ([v]) => s(v).toLowerCase(),
  doc: "Lowercases the string.", category: "string",
});
register({
  name: "upper", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "string",
  eval: ([v]) => s(v).toUpperCase(),
  doc: "Uppercases the string.", category: "string",
});
register({
  name: "trim", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "string",
  eval: ([v]) => s(v).trim(),
  doc: "Strips whitespace from both ends.", category: "string",
});
