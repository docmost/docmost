import { Fragment, Mark, Node } from '@tiptap/pm/model';
import * as Y from 'yjs';
import type { BlockEdit, TextSplice } from './block-edits.types';
import type { BlockRefIndex } from './block-refs';

export type TextChange = {
  splice: TextSplice;
  blockOffset: number;
  matchFrom: number;
  matchTo: number;
  marks: readonly Mark[];
};

type TextRun = {
  path: number[];
  run: number;
  blockOffset: number;
  text: string;
  nodes: Node[];
};

// Inline atoms and textblock boundaries separate searchable runs.
function* textRuns(node: Node, path: number[]): Generator<TextRun> {
  if (!node.isBlock || node.isAtom) return;
  if (node.isTextblock) {
    let run = 0;
    let blockOffset = 0;
    let nodes: Node[] = [];
    for (let i = 0; i <= node.childCount; i++) {
      const child = node.maybeChild(i);
      if (child?.isText) {
        nodes.push(child);
      } else {
        const text = nodes.map((n) => n.text).join('');
        if (text) yield { path, run, blockOffset, text, nodes };
        blockOffset += text.length + (child?.nodeSize ?? 0);
        nodes = [];
        run++;
      }
    }
    return;
  }
  for (let i = 0; i < node.childCount; i++) {
    yield* textRuns(node.child(i), [...path, i]);
  }
}

export function* editableTextRuns(node: Node): Generator<string> {
  for (const run of textRuns(node, [])) yield run.text;
}

export function* literalOffsets(
  text: string,
  needle: string,
): Generator<number> {
  if (!needle) return;
  let from = 0;
  while (from < text.length) {
    const offset = text.indexOf(needle, from);
    if (offset < 0) return;
    yield offset;
    from = offset + (text.codePointAt(offset) > 0xffff ? 2 : 1);
  }
}

type TextMatches = {
  found: Map<number, { run: TextRun; start: number }>;
  count: number;
};

function locateOccurrences(
  node: Node,
  path: number[],
  needle: string,
  requested: Set<number>,
): TextMatches {
  const found: TextMatches['found'] = new Map();
  let count = 0;
  for (const run of textRuns(node, path)) {
    for (const start of literalOffsets(run.text, needle)) {
      count++;
      if (requested.has(count)) found.set(count, { run, start });
      if (found.size === requested.size) return { found, count };
    }
  }
  return { found, count };
}

// Scan repeated queries once, retaining only the ordinals the batch actually needs.
export function indexTextEdits(edits: BlockEdit[], refs: BlockRefIndex) {
  const groups = new Map<string, BlockEdit[]>();
  const indexes = new Map<BlockEdit, TextMatches>();
  for (const edit of edits) {
    if (edit.type !== 'replace_text' || !edit.oldText) continue;
    const key = JSON.stringify([edit.ref, edit.oldText]);
    const group = groups.get(key) ?? [];
    group.push(edit);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length === 1) continue;
    const { node, path } = refs.byRef.get(group[0].ref);
    const requested = new Set(
      group.flatMap((edit) =>
        edit.occurrence === undefined ? [1, 2] : [edit.occurrence],
      ),
    );
    const matches = locateOccurrences(node, path, group[0].oldText, requested);
    for (const edit of group) indexes.set(edit, matches);
  }
  return indexes;
}

const lowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

// Yjs and ProseMirror use UTF-16 offsets, but a change must keep code points whole.
function changedRange(before: string, after: string) {
  let from = 0;
  while (from < before.length && before[from] === after[from]) from++;
  if (lowSurrogate(before.charCodeAt(from))) from--;
  let to = before.length;
  let end = after.length;
  while (to > from && end > from && before[to - 1] === after[end - 1]) {
    to--;
    end--;
  }
  if (lowSurrogate(before.charCodeAt(to))) {
    to++;
    end++;
  }
  return { from, to, text: after.slice(from, end) };
}

export function findTextChange(
  target: Node,
  path: number[],
  oldText: string,
  newText: string,
  occurrence?: number,
  index?: TextMatches,
): TextChange | string {
  if (typeof oldText !== 'string' || !oldText || typeof newText !== 'string') {
    return 'replace_text needs a nonempty oldText and a string newText.';
  }
  if (/\p{Surrogate}/u.test(oldText) || /\p{Surrogate}/u.test(newText)) {
    return 'The text contains an incomplete Unicode character.';
  }
  if (
    occurrence !== undefined &&
    (!Number.isSafeInteger(occurrence) || occurrence < 1)
  )
    return 'occurrence must be a positive integer.';
  const { found, count } =
    index ??
    locateOccurrences(
      target,
      path,
      oldText,
      new Set(occurrence === undefined ? [1, 2] : [occurrence]),
    );
  if (occurrence === undefined && count > 1)
    return 'oldText occurs more than once in this block. Include more surrounding text or use the occurrence from search.';
  const match = found.get(occurrence ?? 1);
  if (!match && occurrence !== undefined)
    return `Occurrence ${occurrence} was not found. This block contains ${count} exact matches for oldText.`;
  if (!match)
    return 'oldText was not found within a single text run in this block.';

  const { run, start } = match;
  const change = changedRange(oldText, newText);
  const from = start + change.from;
  const to = start + change.to;
  const end = start + oldText.length;
  // A pure insertion can inherit either neighboring character within the match.
  const marksAt = from === to && from === end ? from - 1 : from;
  const markFrom = from === to && from > start ? from - 1 : from;
  const markTo = from === to && to < end ? to + 1 : to;
  let marks: readonly Mark[];
  let offset = 0;
  if (change.text) {
    for (const node of run.nodes) {
      const next = offset + node.nodeSize;
      if (next > markFrom && offset < markTo) {
        if (marks && !Mark.sameSet(marks, node.marks)) {
          return 'The changed text spans different formatting or comment marks. Split the edit at the formatting boundary.';
        }
        marks = node.marks;
      }
      offset = next;
    }
  }
  return {
    splice: {
      path: run.path,
      run: run.run,
      before: run.text,
      from,
      to,
      text: change.text,
      marksAt,
      expected: [],
    },
    blockOffset: run.blockOffset,
    matchFrom: start,
    matchTo: end,
    marks: marks ?? [],
  };
}

export function applyTextChange(
  block: Node,
  { splice, blockOffset, marks }: TextChange,
): Node {
  const from = blockOffset + splice.from;
  const to = blockOffset + splice.to;
  const insert = splice.text
    ? block.type.schema.text(splice.text, marks)
    : null;
  return block.copy(
    block.content
      .cut(0, from)
      .append(Fragment.from(insert))
      .append(block.content.cut(to)),
  );
}

// Reuse the text object only when its minimal edit exactly reproduces the submitted rich node.
export function textSpliceForReplacement(
  before: Node,
  after: Node,
  path: number[],
): TextSplice | undefined {
  const nextRuns = new Map(
    [...textRuns(after, path)].map((run) => [run.run, run.text]),
  );
  let candidate: { from: string; to: string };
  for (const run of textRuns(before, path)) {
    const next = nextRuns.get(run.run) ?? '';
    if (run.text === next) continue;
    if (candidate) return;
    candidate = { from: run.text, to: next };
  }
  if (!candidate) return;
  const change = findTextChange(before, path, candidate.from, candidate.to);
  if (typeof change !== 'string' && applyTextChange(before, change).eq(after))
    return change.splice;
}

// Explicit HTML supplies the new text for each existing mark span.
export function markedTextSplices(
  before: Node,
  after: Node,
  path: number[],
): TextSplice[] | undefined {
  if (
    before.childCount !== after.childCount ||
    !before.children.every((child, i) =>
      child.isText
        ? child.sameMarkup(after.child(i))
        : child.eq(after.child(i)),
    )
  )
    return;
  const nextRuns = new Map(
    [...textRuns(after, path)].map((run) => [run.run, run]),
  );
  const changes: TextSplice[] = [];
  for (const run of textRuns(before, path)) {
    const next = nextRuns.get(run.run);
    let offset = 0;
    run.nodes.forEach((node, i) => {
      const desired = next.nodes[i].text;
      if (node.text !== desired) {
        const change = changedRange(node.text, desired);
        changes.push({
          path,
          run: run.run,
          before: run.text,
          from: offset + change.from,
          to: offset + change.to,
          text: change.text,
          marksAt: offset,
          expected: [],
        });
      }
      offset += node.nodeSize;
    });
  }
  return changes.reverse();
}

export function prepareTextSplice(
  block: Y.XmlFragment,
  splice: TextSplice,
): (() => void) | null {
  if (!block) return null;
  const parts: { node: Y.XmlText; offset: number }[] = [];
  const strings: string[] = [];
  let run = 0;
  let offset = 0;
  let attributes: Record<string, unknown>;
  for (const child of block.toArray()) {
    if (!(child instanceof Y.XmlText)) {
      if (++run > splice.run) break;
      continue;
    }
    if (run !== splice.run || child.length === 0) continue;
    parts.push({ node: child, offset });
    for (const delta of child.toDelta()) {
      if (typeof delta.insert !== 'string') return null;
      strings.push(delta.insert);
      const end = offset + delta.insert.length;
      if (offset <= splice.marksAt && splice.marksAt < end) {
        attributes = delta.attributes ?? {};
      }
      offset = end;
    }
  }
  if (strings.join('') !== splice.before || !attributes) return null;

  const anchor =
    parts.find(({ node, offset }) => splice.from < offset + node.length) ??
    parts[parts.length - 1];
  const removals = parts.map(({ node, offset }) => ({
    node,
    index: Math.max(0, splice.from - offset),
    length:
      Math.min(offset + node.length, splice.to) - Math.max(offset, splice.from),
  }));
  return () => {
    for (const { node, index, length } of removals) {
      if (length > 0) node.delete(index, length);
    }
    if (splice.text)
      anchor.node.insert(splice.from - anchor.offset, splice.text, {
        ...attributes,
      });
  };
}
