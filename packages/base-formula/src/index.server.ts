// Server-side public surface: everything in client + evaluator + registry.
export * from "./ast.js";
export * from "./types.js";
export * from "./error.js";
export * from "./tokenizer.js";
export * from "./parser.js";
export * from "./resolver.js";
export * from "./typecheck.js";
export * from "./format.js";
import "./functions/index.js"; // side-effect: populate registry
export { registry, register } from "./functions/index.js";
export type { FormulaFn } from "./functions/index.js";
export * from "./graph.js";
export * from "./eval.js";
export * from "./number.js";
