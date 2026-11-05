import { isSameDocumentContent } from './content-comparison.util';

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

  it('handles null previous content', () => {
    expect(isSameDocumentContent(null, doc(p()))).toBe(false);
    expect(isSameDocumentContent(null, null)).toBe(true);
  });
});
