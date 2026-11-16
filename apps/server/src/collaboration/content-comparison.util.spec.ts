import { getSchema } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import {
  isSameDocumentContent,
  toReviewDocument,
} from './content-comparison.util';
import { tiptapExtensions } from './collaboration.util';

const p = (text?: string, attrs?: Record<string, unknown>) => ({
  type: 'paragraph',
  ...(attrs && { attrs }),
  ...(text && { content: [{ type: 'text', text }] }),
});
const doc = (...content: unknown[]) => ({ type: 'doc', content });
const comment = (resolved = false) => ({
  type: 'comment',
  attrs: { commentId: 'c1', resolved },
});

describe('isSameDocumentContent', () => {
  it('returns true for identical documents', () => {
    expect(isSameDocumentContent(doc(p('a')), doc(p('a')))).toBe(true);
  });

  it('ignores comment marks', () => {
    const withComment = doc({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'hello ' },
        { type: 'text', text: 'world', marks: [comment()] },
      ],
    });
    expect(isSameDocumentContent(doc(p('hello world')), withComment)).toBe(
      true,
    );
  });

  it('ignores resolving a comment', () => {
    const build = (resolved: boolean) =>
      doc({
        type: 'paragraph',
        content: [{ type: 'text', text: 'hi', marks: [comment(resolved)] }],
      });
    expect(isSameDocumentContent(build(false), build(true))).toBe(true);
  });

  it('ignores unique ids', () => {
    const build = (id: string | null) =>
      doc(
        p('a', { id }),
        { type: 'heading', attrs: { level: 1, id }, content: [{ type: 'text', text: 'h' }] },
      );
    expect(isSameDocumentContent(build(null), build('019a0000-0000-7000-8000-000000000000'))).toBe(true);
  });

  it('ignores details open state', () => {
    const build = (open: boolean) =>
      doc({
        type: 'details',
        attrs: { open },
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 's' }] },
          { type: 'detailsContent', content: [p('body')] },
        ],
      });
    expect(isSameDocumentContent(build(false), build(true))).toBe(true);
  });

  it('ignores trailing empty paragraphs', () => {
    expect(isSameDocumentContent(doc(p('a')), doc(p('a'), { type: 'paragraph' }))).toBe(true);
  });

  it('ignores an empty paragraph before a final footnotes node', () => {
    const footnotes = { type: 'footnotes' };
    expect(
      isSameDocumentContent(
        doc(p('a'), footnotes),
        doc(p('a'), { type: 'paragraph' }, footnotes),
      ),
    ).toBe(true);
  });

  it('ignores attributes written with their default value', () => {
    expect(
      isSameDocumentContent(
        doc(p('a')),
        doc(p('a', { indent: 0, dir: 'auto' })),
      ),
    ).toBe(true);
  });

  it('detects text changes', () => {
    expect(isSameDocumentContent(doc(p('a')), doc(p('b')))).toBe(false);
  });

  it('detects added formatting', () => {
    const bold = doc({
      type: 'paragraph',
      content: [{ type: 'text', text: 'a', marks: [{ type: 'bold' }] }],
    });
    expect(isSameDocumentContent(doc(p('a')), bold)).toBe(false);
  });

  it('detects heading level change', () => {
    const build = (level: number) =>
      doc({ type: 'heading', attrs: { level }, content: [{ type: 'text', text: 'h' }] });
    expect(isSameDocumentContent(build(1), build(2))).toBe(false);
  });

  it('detects image src change', () => {
    const build = (src: string) => doc({ type: 'image', attrs: { src } });
    expect(isSameDocumentContent(build('/a.png'), build('/b.png'))).toBe(false);
  });

  it('detects an empty paragraph added in the middle', () => {
    expect(
      isSameDocumentContent(doc(p('a'), p('b')), doc(p('a'), p(), p('b'))),
    ).toBe(false);
  });

  it('treats unknown node types as changed', () => {
    expect(
      isSameDocumentContent(doc(p('a')), {
        type: 'doc',
        content: [{ type: 'madeUpNode' }],
      }),
    ).toBe(false);
  });

  it('treats missing content as an empty document', () => {
    expect(isSameDocumentContent(null, doc(p()))).toBe(true);
    expect(isSameDocumentContent(undefined, doc(p()))).toBe(true);
    expect(isSameDocumentContent(doc(p()), null)).toBe(true);
    expect(isSameDocumentContent(null, null)).toBe(true);
  });

  it('detects text added to missing content', () => {
    expect(isSameDocumentContent(null, doc(p('a')))).toBe(false);
    expect(isSameDocumentContent(doc(p('a')), undefined)).toBe(false);
  });
});

describe('toReviewDocument', () => {
  const ID = '019a0000-0000-7000-8000-000000000000';
  const text = (t: string, marks?: unknown[]) => ({
    type: 'text',
    text: t,
    ...(marks && { marks }),
  });
  const details = (open: boolean) => ({
    type: 'details',
    attrs: { open },
    content: [
      { type: 'detailsSummary', content: [text('s')] },
      { type: 'detailsContent', content: [p('body')] },
    ],
  });
  const rich = doc(
    p('a', { id: ID }),
    details(false),
    {
      type: 'paragraph',
      content: [
        text('x', [comment()]),
        { type: 'footnoteReference', attrs: { 'data-id': 'fn1' } },
      ],
    },
    { type: 'paragraph' },
    {
      type: 'footnotes',
      content: [
        {
          type: 'footnote',
          attrs: { id: 'fn1', 'data-id': 'fn1' },
          content: [p('note')],
        },
      ],
    },
  );

  it('removes comment marks and keeps other marks', () => {
    const result: any = toReviewDocument(
      doc({
        type: 'paragraph',
        content: [text('a', [comment(), { type: 'bold' }])],
      }),
    );
    expect(result.content[0].content[0].marks).toEqual([{ type: 'bold' }]);
  });

  it('sets details open to true', () => {
    const result: any = toReviewDocument(doc(details(false)));
    expect(result.content[0].attrs.open).toBe(true);
  });

  it('removes ids from heading, paragraph and transclusionSource only', () => {
    const result: any = toReviewDocument(
      doc(
        p('a', { id: ID }),
        {
          type: 'heading',
          attrs: { level: 1, id: ID },
          content: [text('h')],
        },
        { type: 'transclusionSource', attrs: { id: ID }, content: [p('t')] },
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: 'm1', label: 'x' } },
            { type: 'footnoteReference', attrs: { id: 'fn1' } },
          ],
        },
        {
          type: 'tabs',
          attrs: { id: 'tab1' },
          content: [],
        },
        { type: 'footnote', attrs: { id: 'fn1' } },
      ),
    );
    const [para, heading, source, mixed, tabs, footnote] = result.content;
    expect(para.attrs?.id).toBeUndefined();
    expect(heading.attrs.id).toBeUndefined();
    expect(heading.attrs.level).toBe(1);
    expect(source.attrs?.id).toBeUndefined();
    expect(mixed.content[0].attrs.id).toBe('m1');
    expect(mixed.content[1].attrs.id).toBe('fn1');
    expect(tabs.attrs.id).toBe('tab1');
    expect(footnote.attrs.id).toBe('fn1');
  });

  it('drops trailing empty paragraphs, also before footnotes', () => {
    const footnotes = { type: 'footnotes' };
    expect(toReviewDocument(doc(p('a'), p(), p()))).toEqual(doc(p('a')));
    expect(toReviewDocument(doc(p('a'), p(), footnotes))).toEqual(
      doc(p('a'), footnotes),
    );
  });

  it('treats null and undefined as an empty document', () => {
    expect(toReviewDocument(null)).toEqual({ type: 'doc', content: [] });
    expect(toReviewDocument(undefined)).toEqual({ type: 'doc', content: [] });
  });

  it('does not mutate its input', () => {
    const input = JSON.parse(JSON.stringify(rich));
    toReviewDocument(input);
    expect(input).toEqual(rich);
  });

  it('is idempotent', () => {
    const once = toReviewDocument(rich);
    expect(toReviewDocument(once)).toEqual(once);
  });

  it('parses with the server schema', () => {
    const schema = getSchema(tiptapExtensions);
    expect(() => Node.fromJSON(schema, toReviewDocument(rich))).not.toThrow();
  });

  it('gives equal nodes for documents isSameDocumentContent treats as equal', () => {
    const schema = getSchema(tiptapExtensions);
    const withComment = doc({
      type: 'paragraph',
      content: [text('hello '), text('world', [comment()])],
    });
    const heading = (id: string | null) => ({
      type: 'heading',
      attrs: { level: 1, id },
      content: [text('h')],
    });
    const footnotes = { type: 'footnotes' };
    const commented = (resolved: boolean) =>
      doc({
        type: 'paragraph',
        content: [{ type: 'text', text: 'hi', marks: [comment(resolved)] }],
      });
    const pairs: [unknown, unknown][] = [
      [doc(p('hello world')), withComment],
      [commented(false), commented(true)],
      [
        doc(p('a', { id: null }), heading(null)),
        doc(p('a', { id: ID }), heading(ID)),
      ],
      [doc(details(false)), doc(details(true))],
      [doc(p('a')), doc(p('a'), { type: 'paragraph' })],
      [doc(p('a'), footnotes), doc(p('a'), { type: 'paragraph' }, footnotes)],
      [doc(p('a')), doc(p('a', { indent: 0, dir: 'auto' }))],
      [null, doc(p())],
      [undefined, doc(p())],
    ];
    for (const [a, b] of pairs) {
      expect(isSameDocumentContent(a, b)).toBe(true);
      const nodeA = Node.fromJSON(schema, toReviewDocument(a));
      const nodeB = Node.fromJSON(schema, toReviewDocument(b));
      expect(nodeA.eq(nodeB)).toBe(true);
    }
  });
});
