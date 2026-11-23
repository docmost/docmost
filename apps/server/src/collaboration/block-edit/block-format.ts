import { isDeepStrictEqual } from 'node:util';
import { Fragment, Mark, Node } from '@tiptap/pm/model';
import * as Y from 'yjs';

const unmarkedContent = (node: Node) =>
  Fragment.fromArray(
    node.children.map((child) =>
      child.isText ? child.mark(Mark.none) : child,
    ),
  );

export function changesOnlyTextMarks(before: Node, after: Node): boolean {
  return (
    before.content.size === after.content.size &&
    unmarkedContent(before).eq(unmarkedContent(after))
  );
}

export function changedAttributes(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(before)) {
    if (!(key in after)) patch[key] = null;
  }
  for (const [key, value] of Object.entries(after)) {
    if (!isDeepStrictEqual(value, before[key])) patch[key] = value;
  }
  return patch;
}

type YTextRun = {
  node: Y.XmlText;
  index: number;
  text: string;
  attrs: Record<string, unknown>;
};
function runsByAtom(block: Y.XmlFragment) {
  const runs: YTextRun[][] = [[]];
  for (const child of block.toArray()) {
    if (!(child instanceof Y.XmlText)) {
      runs.push([]);
      continue;
    }
    let index = 0;
    for (const delta of child.toDelta()) {
      if (typeof delta.insert !== 'string' || !delta.insert) return;
      runs[runs.length - 1].push({
        node: child,
        index,
        text: delta.insert,
        attrs: delta.attributes ?? {},
      });
      index += delta.insert.length;
    }
  }
  return runs;
}

// Yjs can split one PM text run across formatting deltas or multiple XmlText objects.
export function prepareFormatSplice(
  source: Y.XmlFragment,
  desired: Y.XmlFragment,
  fill = false,
): (() => void) | null {
  if (fill) {
    const existing = source.toArray();
    if (existing.some((node) => !(node instanceof Y.XmlText) || node.length))
      return null;
    const children = desired.toArray();
    const oldText = existing[0];
    const newText = children[0];
    if (
      children.length === 1 &&
      newText instanceof Y.XmlText &&
      oldText instanceof Y.XmlText
    ) {
      const delta = newText.toDelta();
      return () => oldText.applyDelta(delta, { sanitize: false });
    }
    const inserts: Array<Y.XmlElement | Y.XmlText> = [];
    for (const node of children) {
      if (!(node instanceof Y.XmlElement || node instanceof Y.XmlText))
        return null;
      inserts.push(node.clone());
    }
    return () => source.insert(0, inserts);
  }
  const before = runsByAtom(source);
  const after = runsByAtom(desired);
  if (!before || !after || before.length !== after.length) return null;
  const steps: Array<() => void> = [];
  for (let group = 0; group < before.length; group++) {
    const left = before[group],
      right = after[group];
    let a = 0,
      b = 0,
      leftOffset = 0,
      rightOffset = 0;
    while (a < left.length && b < right.length) {
      const from = left[a],
        to = right[b];
      const length = Math.min(
        from.text.length - leftOffset,
        to.text.length - rightOffset,
      );
      if (
        from.text.slice(leftOffset, leftOffset + length) !==
        to.text.slice(rightOffset, rightOffset + length)
      )
        return null;
      const attrs = changedAttributes(from.attrs, to.attrs);
      if (Object.keys(attrs).length) {
        const index = from.index + leftOffset;
        steps.push(() => from.node.format(index, length, attrs));
      }
      leftOffset += length;
      rightOffset += length;
      if (leftOffset === from.text.length) {
        a++;
        leftOffset = 0;
      }
      if (rightOffset === to.text.length) {
        b++;
        rightOffset = 0;
      }
    }
    if (a !== left.length || b !== right.length) return null;
  }
  return () => {
    for (const apply of steps) apply();
  };
}
