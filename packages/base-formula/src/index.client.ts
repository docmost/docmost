// Client-side public surface: parse, typecheck, cycle-detect, pretty-print.
// Does NOT export eval. Registry is exposed (metadata + function shape) so the
// client can drive typechecking and the function palette in the formula editor.
import "./functions/index";
export * from "./ast";
export * from "./types";
export * from "./error";
export * from "./tokenizer";
export * from "./parser";
export * from "./resolver";
export * from "./typecheck";
export * from "./format";
export { registry, register } from "./functions/registry";
export type { FormulaFn } from "./functions/registry";
export * from "./graph";
