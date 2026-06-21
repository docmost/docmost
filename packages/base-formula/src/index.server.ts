// Server-side public surface: everything in client + evaluator + registry.
export * from "./ast";
export * from "./types";
export * from "./error";
export * from "./tokenizer";
export * from "./parser";
export * from "./resolver";
export * from "./typecheck";
export * from "./format";
import "./functions/index"; // side-effect: populate registry
export { registry, register } from "./functions/index";
export type { FormulaFn } from "./functions/index";
export * from "./graph";
export * from "./eval";
export * from "./number";
