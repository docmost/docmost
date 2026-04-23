// packages/base-formula/src/functions/math.ts
import { register } from "./registry";

const num = (v: unknown): number | null => v == null ? null : Number(v);

register({
  name: "round", arity: { min: 1, max: 1 }, paramTypes: ["number"], returnType: "number",
  eval: ([v]) => { const n = num(v); return n == null ? null : Math.round(n); },
  doc: "Rounds to the nearest integer.", category: "math",
});
register({
  name: "floor", arity: { min: 1, max: 1 }, paramTypes: ["number"], returnType: "number",
  eval: ([v]) => { const n = num(v); return n == null ? null : Math.floor(n); },
  doc: "Rounds down.", category: "math",
});
register({
  name: "ceil", arity: { min: 1, max: 1 }, paramTypes: ["number"], returnType: "number",
  eval: ([v]) => { const n = num(v); return n == null ? null : Math.ceil(n); },
  doc: "Rounds up.", category: "math",
});
register({
  name: "abs", arity: { min: 1, max: 1 }, paramTypes: ["number"], returnType: "number",
  eval: ([v]) => { const n = num(v); return n == null ? null : Math.abs(n); },
  doc: "Absolute value.", category: "math",
});
register({
  name: "min", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "number",
  eval: (args) => {
    const nums = args.map(num).filter((n): n is number => n != null);
    return nums.length ? Math.min(...nums) : null;
  },
  doc: "Minimum of the arguments.", category: "math",
});
register({
  name: "max", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "number",
  eval: (args) => {
    const nums = args.map(num).filter((n): n is number => n != null);
    return nums.length ? Math.max(...nums) : null;
  },
  doc: "Maximum of the arguments.", category: "math",
});
register({
  name: "mod", arity: { min: 2, max: 2 }, paramTypes: ["number", "number"], returnType: "number",
  eval: ([a, b]) => {
    const na = num(a), nb = num(b);
    if (na == null || nb == null) return null;
    if (nb === 0) throw new Error("modulo by zero");
    return na % nb;
  },
  doc: "Remainder after division.", category: "math",
});
