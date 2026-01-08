import type { Node as PMNode } from "@tiptap/pm/model";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

type DiffOp =
  | { type: "equal"; aIndex: number; bIndex: number }
  | { type: "insert"; bIndex: number }
  | { type: "delete"; aIndex: number };

function myersDiff(a: string[], b: string[]): DiffOp[] {
  const N = a.length;
  const M = b.length;
  const max = N + M;

  let v = new Map<number, number>();
  v.set(1, 0);
  const trace: Array<Map<number, number>> = [];

  for (let d = 0; d <= max; d += 1) {
    const vNew = new Map<number, number>();
    for (let k = -d; k <= d; k += 2) {
      const vKMinus = v.get(k - 1) ?? 0;
      const vKPlus = v.get(k + 1) ?? 0;

      let x: number;
      if (k === -d || (k !== d && vKMinus < vKPlus)) {
        x = vKPlus;
      } else {
        x = vKMinus + 1;
      }

      let y = x - k;
      while (x < N && y < M && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      vNew.set(k, x);

      if (x >= N && y >= M) {
        trace.push(vNew);
        return backtrack(trace, a, b);
      }
    }
    trace.push(vNew);
    v = vNew;
  }

  return [];
}

function backtrack(trace: Array<Map<number, number>>, a: string[], b: string[]) {
  let x = a.length;
  let y = b.length;
  const ops: DiffOp[] = [];

  for (let d = trace.length - 1; d > 0; d -= 1) {
    const v = trace[d];
    const prevV = trace[d - 1];

    const k = x - y;

    const prevK =
      k === -d || (k !== d && (prevV.get(k - 1) ?? 0) < (prevV.get(k + 1) ?? 0))
        ? k + 1
        : k - 1;

    const prevX = prevV.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ type: "equal", aIndex: x - 1, bIndex: y - 1 });
      x -= 1;
      y -= 1;
    }

    if (x === prevX) {
      ops.push({ type: "insert", bIndex: y - 1 });
      y -= 1;
    } else {
      ops.push({ type: "delete", aIndex: x - 1 });
      x -= 1;
    }
  }

  while (x > 0 && y > 0) {
    ops.push({ type: "equal", aIndex: x - 1, bIndex: y - 1 });
    x -= 1;
    y -= 1;
  }
  while (x > 0) {
    ops.push({ type: "delete", aIndex: x - 1 });
    x -= 1;
  }
  while (y > 0) {
    ops.push({ type: "insert", bIndex: y - 1 });
    y -= 1;
  }

  ops.reverse();
  return ops;
}

export interface HistoryBlockDiffResult {
  diffDoc: PMNode;
  addedNodeRanges: Array<{ from: number; to: number }>;
  deletedNodeRanges: Array<{ from: number; to: number }>;
  addedCount: number;
  deletedCount: number;
}

export function computeHistoryBlockDiff(
  currentDoc: PMNode,
  prevDoc: PMNode,
): HistoryBlockDiffResult {
  const currentTop = Array.from({ length: currentDoc.childCount }, (_, i) =>
    currentDoc.child(i),
  );
  const prevTop = Array.from({ length: prevDoc.childCount }, (_, i) =>
    prevDoc.child(i),
  );

  const currentHashes = currentTop.map((n) => stableStringify(n.toJSON()));
  const prevHashes = prevTop.map((n) => stableStringify(n.toJSON()));

  const ops = myersDiff(prevHashes, currentHashes);

  const nodes: PMNode[] = [];
  const addedIndices: number[] = [];
  const deletedIndices: number[] = [];

  for (const op of ops) {
    if (op.type === "equal") {
      nodes.push(currentTop[op.bIndex]);
      continue;
    }
    if (op.type === "insert") {
      addedIndices.push(nodes.length);
      nodes.push(currentTop[op.bIndex]);
      continue;
    }
    deletedIndices.push(nodes.length);
    nodes.push(prevTop[op.aIndex]);
  }

  const diffDoc = currentDoc.type.create(null, nodes);

  const addedNodeRanges: Array<{ from: number; to: number }> = [];
  const deletedNodeRanges: Array<{ from: number; to: number }> = [];

  let pos = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const from = pos;
    const to = pos + node.nodeSize;
    if (addedIndices.includes(i)) addedNodeRanges.push({ from, to });
    if (deletedIndices.includes(i)) deletedNodeRanges.push({ from, to });
    pos = to;
  }

  return {
    diffDoc,
    addedNodeRanges,
    deletedNodeRanges,
    addedCount: addedIndices.length,
    deletedCount: deletedIndices.length,
  };
}


