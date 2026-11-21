import {
  getHtmlBlockIds,
  replaceHtmlBlockIds,
  replaceHtmlBlocksWithCode,
} from './html-block.utils';

const A = '0192f0aa-0000-7000-8000-000000000001';
const B = '0192f0aa-0000-7000-8000-000000000002';
const C = '0192f0aa-0000-7000-8000-000000000003';
const D = '0192f0aa-0000-7000-8000-000000000004';

const block = (id: any) => ({ type: 'htmlBlock', attrs: { htmlBlockId: id } });
const para = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

const nestedDoc = () => ({
  type: 'doc',
  content: [
    block(A),
    {
      type: 'columns',
      content: [
        { type: 'column', content: [block(B), block(A)] },
        { type: 'column', content: [block(null), block('not-a-uuid')] },
      ],
    },
    {
      type: 'tabs',
      content: [{ type: 'tab', content: [block(C)] }],
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [{ type: 'tableCell', content: [block(D)] }],
        },
      ],
    },
  ],
});

describe('getHtmlBlockIds', () => {
  it('returns unique valid ids in document order from nested content', () => {
    expect(getHtmlBlockIds(nestedDoc())).toEqual([A, B, C, D]);
  });

  it('skips null and invalid ids and non-objects', () => {
    expect(getHtmlBlockIds(null)).toEqual([]);
    expect(getHtmlBlockIds({ type: 'doc', content: [block(null)] })).toEqual([]);
  });
});

describe('replaceHtmlBlockIds', () => {
  it('rewrites mapped ids and leaves others', () => {
    const X = '0192f0aa-0000-7000-8000-0000000000aa';
    const result = replaceHtmlBlockIds(nestedDoc(), new Map([[A, X]]));
    expect(getHtmlBlockIds(result)).toEqual([X, B, C, D]);
  });

  it('does not mutate the input', () => {
    const input = nestedDoc();
    const snapshot = JSON.stringify(input);
    const X = '0192f0aa-0000-7000-8000-0000000000aa';
    replaceHtmlBlockIds(input, new Map([[A, X]]));
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('replaceHtmlBlocksWithCode', () => {
  it('turns a block into an html code block with the exact text', () => {
    const html = '<div>\n  <b>héllo</b>\n</div>';
    const result: any = replaceHtmlBlocksWithCode(
      { type: 'doc', content: [block(A)] },
      new Map([[A, html]]),
    );
    expect(result.content).toEqual([
      {
        type: 'codeBlock',
        attrs: { language: 'html' },
        content: [{ type: 'text', text: html }],
      },
    ]);
  });

  it('gives a code block without content for empty html', () => {
    const result: any = replaceHtmlBlocksWithCode(
      { type: 'doc', content: [block(A)] },
      new Map([[A, '']]),
    );
    expect(result.content).toEqual([
      { type: 'codeBlock', attrs: { language: 'html' } },
    ]);
  });

  it('drops unknown ids and keeps siblings in order, including nested', () => {
    const doc = {
      type: 'doc',
      content: [
        para('one'),
        block(A),
        {
          type: 'columns',
          content: [
            { type: 'column', content: [para('two'), block(B), para('three')] },
          ],
        },
        block(C),
        para('four'),
      ],
    };
    const result: any = replaceHtmlBlocksWithCode(
      doc,
      new Map([
        [A, '<p>a</p>'],
        [B, '<p>b</p>'],
      ]),
    );
    expect(result.content.map((n: any) => n.type)).toEqual([
      'paragraph',
      'codeBlock',
      'columns',
      'paragraph',
    ]);
    expect(result.content[2].content[0].content.map((n: any) => n.type)).toEqual(
      ['paragraph', 'codeBlock', 'paragraph'],
    );
    expect(result.content[2].content[0].content[1].content[0].text).toBe(
      '<p>b</p>',
    );
  });
});
