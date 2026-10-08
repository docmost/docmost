import { register } from "./registry";
import { valueToString } from "../number";

register({
  name: "toNumber", arity: { min: 1, max: 1 }, paramTypes: "any", returnType: "number",
  eval: ([v]) => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  },
  doc: "Parses the value as a number, or null.", category: "coercion",
});
register({
  name: "toString", arity: { min: 1, max: 1 }, paramTypes: "any", returnType: "string",
  eval: ([v]) => valueToString(v),
  doc: "Converts the value to a string.", category: "coercion",
});
