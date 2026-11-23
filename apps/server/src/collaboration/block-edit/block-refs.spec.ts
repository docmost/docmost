import type { JSONContent } from '@tiptap/core';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { jsonToNode, tiptapExtensions } from '../collaboration.util';
import { computeBlockRefs, editableDocument, pageRevision } from './block-refs';

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
  it('numbers addressable blocks in preorder using base 36', () => {
    const { byRef } = refsOf(
      doc(paragraph('one'), paragraph('two'), { type: 'horizontalRule' }),
    );

    expect([...byRef.keys()]).toEqual(['b1', 'b2', 'b3']);
    const many = refsOf(
      doc(...Array.from({ length: 36 }, () => paragraph('same'))),
    );
    expect(many.byRef.get('bz').path).toEqual([34]);
    expect(many.byRef.get('b10').path).toEqual([35]);
  });

  it('scopes all refs to the revision even if a changed block occupies the same position', () => {
    const before = editableDocument(doc(paragraph('one'), paragraph('two')));
    const after = editableDocument(
      doc(paragraph('one'), paragraph('two changed')),
    );
    expect(computeBlockRefs(before).byRef.get('b2').node.textContent).toBe(
      'two',
    );
    expect(computeBlockRefs(after).byRef.get('b2').node.textContent).toBe(
      'two changed',
    );
    expect(pageRevision(before)).not.toBe(pageRevision(after));
  });

  it('assigns identical blocks separate positions', () => {
    const { byRef } = refsOf(
      doc({ type: 'horizontalRule' }, { type: 'horizontalRule' }),
    );
    const [first, second] = [...byRef.keys()];

    expect([first, second]).toEqual(['b1', 'b2']);
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
            content: [{ type: 'tableCell', content: [paragraph('cell')] }],
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
    expect([...table.byRef.values()].map((e) => e.node.type.name)).toEqual([
      'table',
      'tableRow',
    ]);
  });

  it('addresses blocks inside toggles and tab panels', () => {
    const { byRef } = refsOf(
      doc(
        {
          type: 'details',
          content: [
            { type: 'detailsSummary', content: [text('Summary')] },
            { type: 'detailsContent', content: [paragraph('hidden')] },
          ],
        },
        {
          type: 'tabs',
          content: [
            {
              type: 'tab',
              content: [
                { type: 'tabLabel', content: [text('Label')] },
                { type: 'tabPanel', content: [paragraph('panel')] },
              ],
            },
          ],
        },
      ),
    );
    const paths = [...byRef.values()].map((e) => [e.node.type.name, e.path]);

    expect(paths).toEqual([
      ['details', [0]],
      ['detailsSummary', [0, 0]],
      ['detailsContent', [0, 1]],
      ['paragraph', [0, 1, 0]],
      ['tabs', [1]],
      ['tab', [1, 0]],
      ['tabLabel', [1, 0, 0]],
      ['tabPanel', [1, 0, 1]],
      ['paragraph', [1, 0, 1, 0]],
    ]);
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
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [paragraph('head')] },
              { type: 'tableCell', content: [paragraph('cell')] },
            ],
          },
        ],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [paragraph('done')],
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
    );
    const ydoc = TiptapTransformer.toYdoc(json, 'default', tiptapExtensions);
    const roundTripped = TiptapTransformer.fromYdoc(ydoc, 'default');

    const stored = refsOf(json);
    const live = refsOf(roundTripped as JSONContent);
    const shape = (index: typeof stored) =>
      [...index.byRef.entries()].map(([ref, e]) => [ref, e.path]);

    expect(stored.byRef.size).toBeGreaterThan(0);
    expect(shape(live)).toEqual(shape(stored));
    expect(pageRevision(editableDocument(roundTripped))).toBe(
      pageRevision(editableDocument(json)),
    );
  });
});

describe('editable page revisions', () => {
  it('normalizes schema defaults and nested object key order while hashing every meaningful value', () => {
    const file = (items: object[], attrs = {}) =>
      doc({ type: 'microsoftFile', attrs: { items, ...attrs } });
    const revision = (input: JSONContent) =>
      pageRevision(editableDocument(input));
    const first = revision(file([{ name: 'Notes', webUrl: '/notes' }]));
    expect(first).toMatch(/^v1-[A-Za-z0-9_-]{43}$/);
    expect(
      revision(file([{ webUrl: '/notes', name: 'Notes' }], { width: 800 })),
    ).toBe(first);
    expect(revision(file([{ webUrl: '/notes', name: 'Draft' }]))).not.toBe(
      first,
    );
    const legacy = file([{ name: 'Notes', webUrl: '/notes' }], { width: null });
    const roundTrip = TiptapTransformer.fromYdoc(
      TiptapTransformer.toYdoc(legacy, 'default', tiptapExtensions),
      'default',
    );
    expect(revision(legacy)).toBe(revision(roundTrip));
    expect(revision(legacy)).toBe(first);
    expect(
      revision(
        doc({
          type: 'paragraph',
          content: [{ ...text('body'), marks: [{ type: 'bold' }] }],
        }),
      ),
    ).not.toBe(revision(doc(paragraph('body'))));
  });

  it('accepts a pristine empty fragment and refuses unknown native data or invalid structure', () => {
    expect(editableDocument(doc()).childCount).toBe(0);
    expect(() =>
      editableDocument(
        doc({
          type: 'paragraph',
          content: [{ type: 'hardBreak', marks: [{ type: 'bold' }] }],
        }),
      ),
    ).toThrow(/cannot be preserved in collaboration/);
    expect(() => editableDocument(doc({ type: 'futureWidget' }))).toThrow(
      /Unsupported node/,
    );
    expect(() =>
      editableDocument(
        doc({ ...paragraph('body'), attrs: { future: { label: 'x' } } }),
      ),
    ).toThrow(/Unsupported attribute/);
    expect(() =>
      editableDocument(
        doc({
          type: 'paragraph',
          content: [
            {
              ...text('body'),
              marks: [{ type: 'bold', attrs: { future: 1 } }],
            },
          ],
        }),
      ),
    ).toThrow(/Unsupported attribute/);
    expect(() =>
      editableDocument(
        doc({
          type: 'paragraph',
          content: [{ ...text('body'), marks: [{ type: 'futureMark' }] }],
        }),
      ),
    ).toThrow(/Unsupported mark/);
    expect(() =>
      editableDocument(
        doc({ type: 'bulletList', content: [paragraph('invalid')] }),
      ),
    ).toThrow(/Invalid content/);
    expect(
      editableDocument(doc({ ...paragraph('body'), attrs: { future: null } }))
        .childCount,
    ).toBe(1);
  });
});
