// MIT - https://github.com/chbrown/rfc6902/blob/master/diff.ts
import { createPatch, Operation, Pointer } from "rfc6902";

const EQUAL = 1;
const REMOVE = 2;
const ADD = 3;
const REPLACE = 4;

type ArrayOperation =
  | { op: "add"; index: number; value: any }
  | { op: "remove"; index: number }
  | { op: "replace"; index: number; original: any; value: any };

// same patch as rfc6902's diffArrays, computed in a diagonal band that
// doubles until it holds the edit distance
export function diffJsonArrays(
  input: any,
  output: any,
  ptr: Pointer,
): Operation[] | void {
  if (!Array.isArray(input) || !Array.isArray(output)) return;
  if (input === output) return [];

  // equal last elements are always matched first
  let n = input.length;
  let m = output.length;
  while (n > 0 && m > 0 && jsonEqual(input[n - 1], output[m - 1])) {
    n--;
    m--;
  }

  const ids = new Map<string, number>();
  const idOf = (value: any) => {
    const key = canonicalKey(value);
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
    }
    return id;
  };
  const a = new Int32Array(n);
  const b = new Int32Array(m);
  for (let i = 0; i < n; i++) a[i] = idOf(input[i]);
  for (let j = 0; j < m; j++) b[j] = idOf(output[j]);

  const delta = m - n;
  const edits: ArrayOperation[] = [];
  for (let slack = 16; ; slack *= 2) {
    const lo = Math.min(0, delta) - slack;
    const hi = Math.max(0, delta) + slack;
    // a row holds its cells inside the band, starting from the first one
    const stride = Math.min(hi - lo + 1, m + 1);
    const start = (i: number) => i * stride - Math.max(0, i + lo);
    const cost = new Int32Array((n + 1) * stride);
    const move = new Uint8Array((n + 1) * stride);

    for (let i = 0; i <= n; i++) {
      const row = start(i);
      const above = i > 0 ? start(i - 1) : 0;
      const last = Math.min(m, i + hi);
      for (let j = Math.max(0, i + lo); j <= last; j++) {
        if (i === 0 && j === 0) continue;
        const at = row + j;
        if (
          i > 0 &&
          j > 0 &&
          a[i - 1] === b[j - 1] &&
          jsonEqual(input[i - 1], output[j - 1])
        ) {
          cost[at] = cost[above + j - 1];
          move[at] = EQUAL;
          continue;
        }
        let best = Infinity;
        if (i > 0 && j - i < hi) {
          best = cost[above + j] + 1;
          move[at] = REMOVE;
        }
        if (j > 0 && j - i > lo && cost[at - 1] + 1 < best) {
          best = cost[at - 1] + 1;
          move[at] = ADD;
        }
        if (i > 0 && j > 0 && cost[above + j - 1] + 1 < best) {
          best = cost[above + j - 1] + 1;
          move[at] = REPLACE;
        }
        cost[at] = best;
      }
    }

    // every path costing up to |delta| + 2 * slack stays inside the band
    const distance = cost[start(n) + m];
    const covered = lo <= -n && hi >= m;
    if (distance > Math.abs(delta) + 2 * slack && !covered) continue;

    for (let i = n, j = m; i > 0 || j > 0; ) {
      const step = move[start(i) + j];
      if (step === REMOVE) {
        edits.push({ op: "remove", index: i - 1 });
        i--;
      } else if (step === ADD) {
        edits.push({ op: "add", index: i - 1, value: output[j - 1] });
        j--;
      } else {
        if (step === REPLACE) {
          edits.push({
            op: "replace",
            index: i - 1,
            original: input[i - 1],
            value: output[j - 1],
          });
        }
        i--;
        j--;
      }
    }
    break;
  }

  const operations: Operation[] = [];
  let padding = 0;
  for (const edit of edits.reverse()) {
    if (edit.op === "add") {
      const index = edit.index + 1 + padding;
      const token = index < input.length + padding ? String(index) : "-";
      operations.push({
        op: "add",
        path: ptr.add(token).toString(),
        value: edit.value,
      });
      padding++;
    } else if (edit.op === "remove") {
      operations.push({
        op: "remove",
        path: ptr.add(String(edit.index + padding)).toString(),
      });
      padding--;
    } else {
      const path = ptr.add(String(edit.index + padding)).toString();
      const nested = createPatch(edit.original, edit.value, diffJsonArrays);
      for (const operation of nested) {
        operation.path = path + operation.path;
        operations.push(operation);
      }
    }
  }
  return operations;
}

// same key for values rfc6902 treats as equal
function canonicalKey(value: any): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value !== "object" || value === null) return String(value);
  if (Array.isArray(value)) {
    let key = "[";
    for (let i = 0; i < value.length; i++) key += canonicalKey(value[i]) + ",";
    return key + "]";
  }
  let key = "{";
  for (const name of Object.keys(value).sort()) {
    if (value[name] !== undefined) {
      key += JSON.stringify(name) + ":" + canonicalKey(value[name]) + ",";
    }
  }
  return key + "}";
}

// rfc6902 equality, where a key holding undefined counts as missing
function jsonEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!jsonEqual(a[i], b[i])) return false;
    }
    return true;
  }
  for (const key in a) {
    if (
      hasValue(a, key) &&
      !(hasValue(b, key) && jsonEqual(a[key], b[key]))
    ) {
      return false;
    }
  }
  for (const key in b) {
    if (hasValue(b, key) && !hasValue(a, key)) return false;
  }
  return true;
}

function hasValue(object: any, key: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(object, key) &&
    object[key] !== undefined
  );
}
