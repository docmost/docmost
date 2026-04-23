import {
  parseRaw, resolve, evaluate, registry, isErrorCell, DEFAULT_MAX_DEPTH,
} from "@docmost/base-formula/server";
import "@docmost/base-formula/server"; // ensure functions/index.ts loaded (side-effect)
import type { EvalContext, PropertyLookup, Value } from "@docmost/base-formula/server";

const mkCtx = (props: Record<string, any>): EvalContext => ({
  registry,
  properties: new Map<string, PropertyLookup>(
    Object.keys(props).map((k) => [k, { id: k, type: "number", typeOptions: {} }]),
  ),
  depth: 0,
  maxDepth: DEFAULT_MAX_DEPTH,
  memo: new Map(),
});

const run = (src: string, cells: Record<string, Value>): Value => {
  const names = new Map(Object.keys(cells).map((k) => [k.replace(/^prop_/, ""), k]));
  const { ast } = resolve(parseRaw(src), names);
  return evaluate(ast, cells, mkCtx(cells));
};

describe("evaluate", () => {
  it("evaluates arithmetic", () => {
    expect(run('prop("a") + prop("b")', { prop_a: 2, prop_b: 3 })).toBe(5);
  });
  it("evaluates comparisons", () => {
    expect(run('prop("a") > 0', { prop_a: 1 })).toBe(true);
  });
  it("short-circuits if/then", () => {
    expect(run('if(prop("a") > 0, "pos", "neg")', { prop_a: 5 })).toBe("pos");
    expect(run('if(prop("a") > 0, "pos", "neg")', { prop_a: -1 })).toBe("neg");
  });
  it("short-circuits and/or", () => {
    expect(run('and(true, false)', {})).toBe(false);
    expect(run('or(false, true)', {})).toBe(true);
  });
  it("returns null for null arithmetic", () => {
    expect(run('prop("a") + 1', { prop_a: null })).toBe(null);
  });
  it("returns DIV_BY_ZERO for 1/0", () => {
    const v = run('1 / 0', {});
    expect(isErrorCell(v)).toBe(true);
    if (isErrorCell(v)) expect(v.__err).toBe("DIV_BY_ZERO");
  });
});

// TODO: unskip after Task 15 wires the function registry with round/concat.
describe.skip("evaluate with registered functions", () => {
  it("invokes registered functions", () => {
    expect(run('round(1.6)', {})).toBe(2);
    expect(run('concat("a", "b", "c")', {})).toBe("abc");
  });
});
