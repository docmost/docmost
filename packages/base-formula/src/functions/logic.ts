import { register } from "./registry";

register({
  name: "empty",
  arity: { min: 1, max: 1 },
  paramTypes: "any",
  returnType: "boolean",
  eval: ([v]) => v == null || v === "" || (typeof v === "object" && v !== null && "__err" in v),
  doc: "Returns true if the value is null or empty string or an error.",
  category: "logic",
});
