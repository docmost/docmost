import {
  parseRaw,
  resolve,
  typecheck,
  evaluate,
  registry,
  DEFAULT_MAX_DEPTH,
} from "../src/index.server";
import type {
  FormulaAST,
  EvalContext,
  PropertyLookup,
  Value,
  FormulaResultType,
} from "../src/index.server";

// sample row: properties a..j (numbers), name (string)
const NUM_PROPS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
const cells: Record<string, unknown> = {
  prop_name: "widget",
};
NUM_PROPS.forEach((p, idx) => {
  cells[`prop_${p}`] = (idx + 1) * 7.3 - idx; // arbitrary non-trivial floats
});

const nameToId = new Map<string, string>([
  ["name", "prop_name"],
  ...NUM_PROPS.map((p) => [p, `prop_${p}`] as [string, string]),
]);

const propertyTypes = new Map<string, FormulaResultType>([
  ["prop_name", "string"],
  ...NUM_PROPS.map(
    (p) => [`prop_${p}`, "number"] as [string, FormulaResultType],
  ),
]);

// Base (non-formula) property lookup. Nested-formula cases extend this.
const baseProps = new Map<string, PropertyLookup>([
  ["prop_name", { id: "prop_name", type: "string", typeOptions: {} }],
  ...NUM_PROPS.map(
    (p) =>
      [`prop_${p}`, { id: `prop_${p}`, type: "number", typeOptions: {} }] as [
        string,
        PropertyLookup,
      ],
  ),
]);

function mkCtx(properties: ReadonlyMap<string, PropertyLookup>): EvalContext {
  return {
    registry,
    properties,
    depth: 0,
    maxDepth: DEFAULT_MAX_DEPTH,
    memo: new Map<string, Value>(),
  };
}

//AST shape metrics
function astStats(ast: FormulaAST): { nodes: number; depth: number } {
  let nodes = 0;
  const walk = (n: FormulaAST, d: number): number => {
    nodes++;
    let max = d;
    const kids: FormulaAST[] = [];
    switch (n.t) {
      case "op":
        kids.push(...n.args);
        break;
      case "and":
      case "or":
        kids.push(...n.args);
        break;
      case "call":
        kids.push(...n.args);
        break;
      case "if":
        kids.push(n.cond, n.then, n.else);
        break;
    }
    for (const k of kids) max = Math.max(max, walk(k, d + 1));
    return max;
  };
  const depth = walk(ast, 1);
  return { nodes, depth };
}

// timing harness
function timed(
  fn: () => void,
  targetMs = 600,
): { opsPerSec: number; nsPerOp: number } {
  // warmup ~150ms to let V8 JIT settle
  const warmEnd = performance.now() + 150;
  while (performance.now() < warmEnd) fn();

  // measure: 5 samples, keep the fastest (least noise from GC/scheduler)
  let bestNsPerOp = Infinity;
  for (let s = 0; s < 5; s++) {
    // calibrate batch so each sample ~ targetMs
    let iters = 1024;
    let elapsedMs = 0;
    while (true) {
      const t0 = process.hrtime.bigint();
      for (let i = 0; i < iters; i++) fn();
      const t1 = process.hrtime.bigint();
      elapsedMs = Number(t1 - t0) / 1e6;
      if (elapsedMs >= targetMs) break;
      iters = Math.ceil(
        iters * Math.max(2, targetMs / Math.max(elapsedMs, 0.01)),
      );
    }
    const nsPerOp = (elapsedMs * 1e6) / iters;
    bestNsPerOp = Math.min(bestNsPerOp, nsPerOp);
  }
  return { opsPerSec: 1e9 / bestNsPerOp, nsPerOp: bestNsPerOp };
}

// formula corpus
type Case = { tier: string; name: string; src: string };

function buildArithChain(n: number): string {
  // ((((a + b) * c) - d) ... ) cycling through props/ops
  const ops = ["+", "*", "-"];
  let expr = 'prop("a")';
  for (let i = 0; i < n; i++) {
    const p = NUM_PROPS[(i + 1) % NUM_PROPS.length];
    const op = ops[i % ops.length];
    expr = `(${expr} ${op} prop("${p}"))`;
  }
  return expr;
}

function buildIfChain(tiers: number): string {
  // if(a>t1, "1", if(a>t2, "2", ... "fallback"))
  let expr = '"fallback"';
  for (let i = tiers; i >= 1; i--) {
    expr = `if(prop("a") > ${i * 5}, "${i}", ${expr})`;
  }
  return expr;
}

function buildBalancedAddTree(depth: number): string {
  // add(add(.., ..), add(.., ..)) = full binary tree of `add` calls
  const leaf = () =>
    `prop("${NUM_PROPS[Math.floor(Math.random() * NUM_PROPS.length)]}")`;
  const build = (d: number): string =>
    d === 0 ? leaf() : `add(${build(d - 1)}, ${build(d - 1)})`;
  return build(depth);
}

const cases: Case[] = [
  // BASIC
  { tier: "basic", name: "literal add", src: "1 + 2" },
  { tier: "basic", name: "two-prop add", src: 'prop("a") + prop("b")' },
  { tier: "basic", name: "comparison", src: 'prop("a") > 10' },
  { tier: "basic", name: "neg + mul", src: '-prop("a") * 2' },

  // INTERMEDIATE
  {
    tier: "intermediate",
    name: "round(mul)",
    src: 'round(prop("a") * 1.5, 2)',
  },
  {
    tier: "intermediate",
    name: "if/then/else",
    src: 'if(prop("a") > prop("b"), "hi", "lo")',
  },
  {
    tier: "intermediate",
    name: "string concat",
    src: 'concat(upper(prop("name")), "-", toString(prop("a")))',
  },
  {
    tier: "intermediate",
    name: "bool and/or",
    src: 'and(prop("a") > 0, or(prop("b") < 100, prop("c") == 0))',
  },

  // COMPLEX
  {
    tier: "complex",
    name: "hypotenuse",
    src: 'sqrt(pow(prop("a"), 2) + pow(prop("b"), 2))',
  },
  {
    tier: "complex",
    name: "sum(10 props)",
    src: `sum(${NUM_PROPS.map((p) => `prop("${p}")`).join(", ")})`,
  },
  {
    tier: "complex",
    name: "nested if (4-tier grade)",
    src: 'if(prop("a") > 90, "A", if(prop("a") > 80, "B", if(prop("a") > 70, "C", "F")))',
  },
  {
    tier: "complex",
    name: "mixed math+string+logic",
    src: 'if(and(prop("a") > 0, prop("b") > 0), concat("ok:", toString(round(prop("a") / prop("b"), 2))), "n/a")',
  },

  // DEEPLY NESTED
  { tier: "deep", name: "arith chain x20", src: buildArithChain(20) },
  { tier: "deep", name: "nested if x10 tiers", src: buildIfChain(10) },
  { tier: "deep", name: "balanced fn tree d6", src: buildBalancedAddTree(6) },
];

// nested-formula (cross-property) case
// prop_total (formula) -> prop_sub (formula) -> raw props. Exercises evalProp
// recursion + per-row memoization, the multi-formula recompute hot path.
function buildNestedFormulaCtx(): {
  ast: FormulaAST;
  ctx: EvalContext;
  stats: { nodes: number; depth: number };
} {
  const subRaw = resolve(
    parseRaw('round((prop("a") + prop("b") + prop("c")) / 3, 2)'),
    nameToId,
  ).ast;
  const totalRaw = resolve(
    parseRaw('prop("sub") * prop("d") + prop("e")'),
    // @ts-ignore
    new Map([...nameToId, ["sub", "prop_sub"]]),
  ).ast;

  const props = new Map<string, PropertyLookup>(baseProps);
  props.set("prop_sub", {
    id: "prop_sub",
    type: "formula",
    typeOptions: {
      ast: subRaw,
      source: "",
      resultType: "number",
      dependencies: [],
      astVersion: 1,
    },
  });
  return { ast: totalRaw, ctx: mkCtx(props), stats: astStats(totalRaw) };
}

// run
const fmt = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(2)}M`
    : n >= 1e3
      ? `${(n / 1e3).toFixed(1)}K`
      : n.toFixed(0);

console.log(`\nnode ${process.version} | base-formula engine benchmark\n`);
console.log(
  "tier".padEnd(13) +
    "formula".padEnd(28) +
    "nodes".padStart(6) +
    "depth".padStart(6) +
    "compile op/s".padStart(15) +
    "eval op/s".padStart(13) +
    "eval ns/op".padStart(13),
);
console.log("-".repeat(94));

for (const c of cases) {
  const raw = parseRaw(c.src);
  const { ast } = resolve(raw, nameToId);
  const stats = astStats(ast);
  const ctx = mkCtx(baseProps);

  const compile = timed(() => {
    const r = resolve(parseRaw(c.src), nameToId);
    typecheck(r.ast, propertyTypes, registry);
  });
  const ev = timed(() => {
    ctx.memo.clear(); // fresh per "row" — matches production new Map() per row
    evaluate(ast, cells, ctx);
  });

  console.log(
    c.tier.padEnd(13) +
      c.name.padEnd(28) +
      String(stats.nodes).padStart(6) +
      String(stats.depth).padStart(6) +
      fmt(compile.opsPerSec).padStart(15) +
      fmt(ev.opsPerSec).padStart(13) +
      ev.nsPerOp.toFixed(0).padStart(13),
  );
}

// nested cross-property formula
{
  const { ast, ctx, stats } = buildNestedFormulaCtx();
  const ev = timed(() => {
    ctx.memo.clear();
    evaluate(ast, cells, ctx);
  });
  console.log(
    "nested-prop".padEnd(13) +
      "total->sub->raw".padEnd(28) +
      String(stats.nodes).padStart(6) +
      String(stats.depth).padStart(6) +
      "-".padStart(15) +
      fmt(ev.opsPerSec).padStart(13) +
      ev.nsPerOp.toFixed(0).padStart(13),
  );
}

// whole-table simulation: eval N rows for the complex grade formula
console.log(
  "\nwhole-table recompute simulation (mixed math+string+logic formula):",
);
const tableAst = resolve(
  parseRaw(
    'if(and(prop("a") > 0, prop("b") > 0), concat("ok:", toString(round(prop("a") / prop("b"), 2))), "n/a")',
  ),
  nameToId,
).ast;
for (const rows of [1_000, 10_000, 100_000]) {
  const ctx = mkCtx(baseProps);
  const t0 = process.hrtime.bigint();
  for (let r = 0; r < rows; r++) {
    ctx.memo.clear();
    evaluate(tableAst, cells, ctx);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(
    `  ${fmt(rows).padStart(6)} rows  ->  ${ms.toFixed(1)} ms   (${fmt((rows / ms) * 1000)} rows/sec)`,
  );
}
console.log();
