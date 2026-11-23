import type { TFunction } from "i18next";
import type { Mark, Node } from "@tiptap/pm/model";
import { attrsKey, ignoredMarks } from "./history-token-encoder";

export type FormatChange = {
  // text in the new doc whose marks changed
  ranges: { from: number; to: number }[];
  // nodes in the new doc whose type or attrs changed, next to the ones they replaced
  nodes: { pos: number; node: Node; oldNode: Node }[];
  // mark type names
  added: string[];
  removed: string[];
  changed: string[];
};

type Token =
  | { kind: "char"; pos: number; char: string; marks: readonly Mark[] }
  | { kind: "node"; pos: number; node: Node };

type MarkDiff = {
  added: Set<string>;
  removed: Set<string>;
  changed: Set<string>;
};

const markNames: Record<string, string> = {
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strike: "Strikethrough",
  code: "Code",
  link: "Link",
  highlight: "Highlight",
  textStyle: "Text color",
  subscript: "Subscript",
  superscript: "Superscript",
};

const alignLabels: Record<string, string> = {
  left: "Align left",
  center: "Align center",
  right: "Align right",
  justify: "Justify",
};

const markKeyCache = new WeakMap<readonly Mark[], Map<string, string>>();

// the formatting a change differs in, or null when its text or structure changed too
export function formatChange(
  oldDoc: Node,
  newDoc: Node,
  change: { fromA: number; toA: number; fromB: number; toB: number },
): FormatChange | null {
  if (change.toA - change.fromA !== change.toB - change.fromB) return null;
  const before = rangeTokens(oldDoc, change.fromA, change.toA);
  const after = rangeTokens(newDoc, change.fromB, change.toB);
  if (before.length !== after.length) return null;

  const ranges: FormatChange["ranges"] = [];
  const nodes: FormatChange["nodes"] = [];
  const marks: MarkDiff = {
    added: new Set(),
    removed: new Set(),
    changed: new Set(),
  };
  const markRange = (pos: number) => {
    const last = ranges[ranges.length - 1];
    if (last && last.to === pos) last.to = pos + 1;
    else ranges.push({ from: pos, to: pos + 1 });
  };

  for (let i = 0; i < before.length; i++) {
    const a = before[i];
    const b = after[i];
    if (a.kind === "char" && b.kind === "char") {
      if (a.char !== b.char) return null;
      if (diffMarks(a.marks, b.marks, marks)) markRange(b.pos);
    } else if (a.kind === "node" && b.kind === "node") {
      const sameNode =
        a.node.type === b.node.type &&
        attrsKey(a.node.attrs) === attrsKey(b.node.attrs);
      if (a.node.isLeaf || b.node.isLeaf) {
        // a leaf keeps its content in attrs, like an image's src
        if (!sameNode) return null;
        if (diffMarks(a.node.marks, b.node.marks, marks)) markRange(b.pos);
      } else if (!sameNode) {
        nodes.push({ pos: b.pos, node: b.node, oldNode: a.node });
      }
    } else {
      return null;
    }
  }

  return {
    ranges,
    nodes,
    added: [...marks.added],
    removed: [...marks.removed],
    changed: [...marks.changed],
  };
}

// tooltip for the marks a formatting change added, removed or changed
export function markChangeLabel(
  change: Pick<FormatChange, "added" | "removed" | "changed">,
  t: TFunction,
): string {
  const names = (types: string[]) =>
    types
      .filter((type) => markNames[type])
      .map((type) => t(markNames[type]))
      .join(", ");
  const added = names(change.added);
  const removed = names(change.removed);
  const changed = names(change.changed);

  const parts: string[] = [];
  if (added) parts.push(t("{{formats}} added", { formats: added }));
  if (removed) parts.push(t("{{formats}} removed", { formats: removed }));
  if (changed) parts.push(t("{{formats}} changed", { formats: changed }));
  return parts.join("; ") || t("Formatting changed");
}

// label for a node whose type or attrs changed
export function nodeChangeLabel(
  oldNode: Node,
  node: Node,
  t: TFunction,
): string {
  if (
    oldNode.type !== node.type ||
    oldNode.attrs.level !== node.attrs.level
  ) {
    const from = nodeName(oldNode, t);
    const to = nodeName(node, t);
    if (from && to) return `${from} → ${to}`;
  } else if (
    alignLabels[node.attrs.textAlign] &&
    oldNode.attrs.textAlign !== node.attrs.textAlign &&
    attrsKey({ ...oldNode.attrs, textAlign: null }) ===
      attrsKey({ ...node.attrs, textAlign: null })
  ) {
    return t(alignLabels[node.attrs.textAlign]);
  }
  return t("Formatting changed");
}

function nodeName(node: Node, t: TFunction): string | null {
  switch (node.type.name) {
    case "paragraph":
      return t("Text");
    case "heading":
      return t("Heading {{level}}", { level: node.attrs.level });
    case "codeBlock":
      return t("Code block");
    case "blockquote":
      return t("Quote");
    case "callout":
      return t("Callout");
    default:
      return null;
  }
}

// one token per character and node start in a range
function rangeTokens(doc: Node, from: number, to: number): Token[] {
  const tokens: Token[] = [];
  const walk = (parent: Node, start: number) => {
    parent.forEach((child, offset) => {
      const pos = start + offset;
      const end = pos + child.nodeSize;
      if (end <= from || pos >= to) return;
      if (child.isText) {
        for (let p = Math.max(from, pos); p < Math.min(to, end); p++) {
          tokens.push({
            kind: "char",
            pos: p,
            char: child.text[p - pos],
            marks: child.marks,
          });
        }
        return;
      }
      if (pos >= from) tokens.push({ kind: "node", pos, node: child });
      if (!child.isLeaf) walk(child, pos + 1);
    });
  };
  walk(doc, 0);
  return tokens;
}

// records how two mark sets differ and returns whether they do
function diffMarks(
  before: readonly Mark[],
  after: readonly Mark[],
  diff: MarkDiff,
): boolean {
  const old = markKeys(before);
  const current = markKeys(after);
  let differs = false;
  for (const [type, key] of current) {
    const oldKey = old.get(type);
    if (oldKey === key) continue;
    (oldKey === undefined ? diff.added : diff.changed).add(type);
    differs = true;
  }
  for (const type of old.keys()) {
    if (current.has(type)) continue;
    diff.removed.add(type);
    differs = true;
  }
  return differs;
}

// mark type names with their attrs, leaving out the marks the diff ignores
function markKeys(marks: readonly Mark[]): Map<string, string> {
  let keys = markKeyCache.get(marks);
  if (!keys) {
    keys = new Map();
    for (const mark of marks) {
      if (ignoredMarks.has(mark.type.name)) continue;
      const key = keys.get(mark.type.name) ?? "";
      keys.set(mark.type.name, key + attrsKey(mark.attrs));
    }
    markKeyCache.set(marks, keys);
  }
  return keys;
}
