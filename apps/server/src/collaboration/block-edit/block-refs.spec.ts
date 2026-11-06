import type { JSONContent } from '@tiptap/core';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { jsonToNode, tiptapExtensions } from '../collaboration.util';
import { computeBlockRefs } from './block-refs';

const text = (value: string): JSONContent => ({ type: 'text', text: value });
const paragraph = (value: string): JSONContent => ({
  type: 'paragraph',
  content: [text(value)],
});
const doc = (...content: JSONContent[]): JSONContent => ({
  type: 'doc',
  content,
});

const refsOf = (json: JSONContent) => computeBlockRefs(jsonToNode(json));

describe('computeBlockRefs', () => {
  it('gives every top-level block a 6-char ref', () => {
    const { byRef } = refsOf(
      doc(paragraph('one'), paragraph('two'), { type: 'horizontalRule' }),
    );

    expect(byRef.size).toBe(3);
    for (const ref of byRef.keys()) {
      expect(ref).toMatch(/^[0-9a-z]{6}$/);
    }
  });

  it("keeps a block's ref when another block changes", () => {
    const before = refsOf(doc(paragraph('one'), paragraph('two')));
    const after = refsOf(doc(paragraph('one'), paragraph('two changed')));
    const refAt = (index: BlockIndex, i: number) =>
      [...index.byRef.values()].find((e) => e.path[0] === i).ref;
    type BlockIndex = typeof before;

    expect(refAt(after, 0)).toBe(refAt(before, 0));
    expect(refAt(after, 1)).not.toBe(refAt(before, 1));
  });

  it('suffixes identical blocks in document order', () => {
    const { byRef } = refsOf(
      doc({ type: 'horizontalRule' }, { type: 'horizontalRule' }),
    );
    const [first, second] = [...byRef.keys()];

    expect(first).toMatch(/^[0-9a-z]{6}$/);
    expect(second).toBe(`${first}-2`);
    expect(byRef.get(first).path).toEqual([0]);
    expect(byRef.get(second).path).toEqual([1]);
  });

  it('addresses list items, table rows, columns and callout children', () => {
    const json = doc(
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [paragraph('a')] },
          { type: 'listItem', content: [paragraph('b')] },
        ],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [paragraph('cell')] },
            ],
          },
        ],
      },
      {
        type: 'columns',
        content: [
          { type: 'column', content: [paragraph('left')] },
          { type: 'column', content: [paragraph('right')] },
        ],
      },
      {
        type: 'callout',
        content: [paragraph('first'), paragraph('second')],
      },
    );
    const { byRef } = refsOf(json);
    const pathsOf = (type: string) =>
      [...byRef.values()]
        .filter((e) => e.node.type.name === type)
        .map((e) => e.path);

    expect(pathsOf('listItem')).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(pathsOf('tableRow')).toEqual([[1, 0]]);
    expect(pathsOf('column')).toEqual([
      [2, 0],
      [2, 1],
    ]);
    expect(
      [...byRef.values()]
        .filter((e) => e.path[0] === 3 && e.path.length === 2)
        .map((e) => e.path),
    ).toEqual([
      [3, 0],
      [3, 1],
    ]);
  });

  it('does not address paragraphs inside list items or table cells', () => {
    const json = doc({
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            paragraph('item'),
            {
              type: 'bulletList',
              content: [{ type: 'listItem', content: [paragraph('nested')] }],
            },
          ],
        },
      ],
    });
    const { byRef } = refsOf(json);
    const types = [...byRef.values()].map((e) => e.node.type.name);

    expect(types).toEqual(['bulletList', 'listItem']);

    const table = refsOf(
      doc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [{ type: 'tableCell', content: [paragraph('cell')] }],
          },
        ],
      }),
    );
    expect(
      [...table.byRef.values()].map((e) => e.node.type.name),
    ).toEqual(['table', 'tableRow']);
  });

  it('maps nodes back to their refs by identity', () => {
    const node = jsonToNode(doc(paragraph('one')));
    const { byRef, byNode } = computeBlockRefs(node);
    const [entry] = [...byRef.values()];

    expect(byNode.get(entry.node)).toBe(entry.ref);
    expect(entry.node).toBe(node.child(0));
  });

  it('gives the same refs to stored JSON and its Yjs round trip', () => {
    const json = doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('Title')] },
      paragraph('body'),
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [paragraph('item')] }],
      },
      { type: 'callout', content: [paragraph('note')] },
    );
    const ydoc = TiptapTransformer.toYdoc(json, 'default', tiptapExtensions);
    const roundTripped = TiptapTransformer.fromYdoc(ydoc, 'default');

    const stored = refsOf(json);
    const live = refsOf(roundTripped as JSONContent);
    const shape = (index: typeof stored) =>
      [...index.byRef.entries()].map(([ref, e]) => [ref, e.path]);

    expect(shape(live)).toEqual(shape(stored));
  });
});
