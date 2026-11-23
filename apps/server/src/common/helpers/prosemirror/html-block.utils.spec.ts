import {
  canAuthorHtmlBlocks,
  convertImportedHtmlBlocks,
  getHtmlBlockIds,
  isHtmlBlocksEnabled,
  replaceHtmlBlockIds,
  replaceHtmlBlocksWithCode,
} from './html-block.utils';
import {
  HTML_BLOCK_EXPORT_LANGUAGE,
  HTML_BLOCK_MAX_BYTES,
} from './html-block.constants';

const MAX_BYTES = 5 * 1024 * 1024;

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

  it('uses the given language, for a nested block and a root block', () => {
    const nested: any = replaceHtmlBlocksWithCode(
      { type: 'doc', content: [block(A)] },
      new Map([[A, '<p>a</p>']]),
      { language: 'html-block' },
    );
    const root: any = replaceHtmlBlocksWithCode(
      block(A),
      new Map([[A, '']]),
      { language: 'html-block' },
    );

    expect(nested.content).toEqual([
      {
        type: 'codeBlock',
        attrs: { language: 'html-block' },
        content: [{ type: 'text', text: '<p>a</p>' }],
      },
    ]);
    expect(root).toEqual({
      type: 'codeBlock',
      attrs: { language: 'html-block' },
    });
  });
});

describe('html block constants', () => {
  it('exports blocks as html-block code and caps them at 5 MB', () => {
    expect(HTML_BLOCK_EXPORT_LANGUAGE).toBe('html-block');
    expect(HTML_BLOCK_MAX_BYTES).toBe(MAX_BYTES);
  });
});

describe('convertImportedHtmlBlocks', () => {
  const code = (language: string | null, text?: string) => ({
    type: 'codeBlock',
    attrs: { language },
    ...(text === undefined ? {} : { content: [{ type: 'text', text }] }),
  });
  const rawHtmlBlock = (htmlBlockId: string) => ({
    type: 'htmlBlock',
    attrs: { htmlBlockId, height: null },
  });
  const table = (...cells: object[]) => ({
    type: 'table',
    content: [{ type: 'tableRow', content: cells }],
  });
  const cell = (type: 'tableCell' | 'tableHeader', ...content: object[]) => ({
    type,
    content,
  });
  const columns = (...content: object[]) => ({
    type: 'columns',
    content: [{ type: 'column', content }],
  });
  const sequentialIds = () => {
    let count = 0;
    return jest.fn(() => `id-${++count}`);
  };
  const findNodes = (json: any, type: string): any[] => [
    ...(json?.type === type ? [json] : []),
    ...(json?.content ?? []).flatMap((child: any) => findNodes(child, type)),
  ];
  const codeLanguages = (json: any) =>
    findNodes(json, 'codeBlock').map((node) => node.attrs.language);
  const nestedImport = () => ({
    type: 'doc',
    content: [
      code('html-block', '<div>\n  <b>héllo</b>\n</div>'),
      columns(para('before'), code('html-block', '<p>two</p>')),
      {
        type: 'tabs',
        content: [
          {
            type: 'tab',
            content: [
              { type: 'tabLabel', content: [{ type: 'text', text: 'Tab' }] },
              {
                type: 'tabPanel',
                content: [code('html-block', '<p>three</p>')],
              },
            ],
          },
        ],
      },
      table(cell('tableCell', code('html-block', '<p>four</p>'))),
    ],
  });

  it('turns html-block code into blocks where the schema allows one, in document order', () => {
    const generateId = sequentialIds();

    const { json, blocks }: any = convertImportedHtmlBlocks(nestedImport(), {
      allowed: true,
      generateId,
    });

    expect(blocks).toEqual([
      { id: 'id-1', content: '<div>\n  <b>héllo</b>\n</div>' },
      { id: 'id-2', content: '<p>two</p>' },
      { id: 'id-3', content: '<p>three</p>' },
    ]);
    expect(generateId).toHaveBeenCalledTimes(3);
    expect(json.content[0]).toEqual(rawHtmlBlock('id-1'));
    expect(json.content[1].content[0].content).toEqual([
      para('before'),
      rawHtmlBlock('id-2'),
    ]);
    expect(json.content[2].content[0].content[1].content).toEqual([
      rawHtmlBlock('id-3'),
    ]);
    expect(findNodes(json.content[3], 'codeBlock')).toEqual([
      code('html', '<p>four</p>'),
    ]);
  });

  it('keeps html-block code in table cells as html code next to a converted block', () => {
    const generateId = sequentialIds();

    const { json, blocks }: any = convertImportedHtmlBlocks(
      {
        type: 'doc',
        content: [
          code('html-block', '<p>top</p>'),
          table(
            cell('tableHeader', code('html-block', '<p>header</p>')),
            cell('tableCell', code('html-block', '<p>cell</p>')),
          ),
        ],
      },
      { allowed: true, generateId },
    );

    expect(blocks).toEqual([{ id: 'id-1', content: '<p>top</p>' }]);
    expect(generateId).toHaveBeenCalledTimes(1);
    expect(json.content[0]).toEqual(rawHtmlBlock('id-1'));
    expect(findNodes(json.content[1], 'htmlBlock')).toEqual([]);
    expect(findNodes(json.content[1], 'codeBlock')).toEqual([
      code('html', '<p>header</p>'),
      code('html', '<p>cell</p>'),
    ]);
  });

  it('keeps the code as html when not allowed', () => {
    const generateId = sequentialIds();

    const { json, blocks }: any = convertImportedHtmlBlocks(nestedImport(), {
      allowed: false,
      generateId,
    });

    expect(blocks).toEqual([]);
    expect(generateId).not.toHaveBeenCalled();
    expect(findNodes(json, 'htmlBlock')).toEqual([]);
    expect(codeLanguages(json)).toEqual(['html', 'html', 'html', 'html']);
    expect(json.content[0]).toEqual(
      code('html', '<div>\n  <b>héllo</b>\n</div>'),
    );
  });

  it('drops raw htmlBlock nodes and fills a container they leave empty', () => {
    for (const allowed of [true, false]) {
      const { json, blocks }: any = convertImportedHtmlBlocks(
        {
          type: 'doc',
          content: [
            rawHtmlBlock('foreign-1'),
            para('kept'),
            columns(rawHtmlBlock('foreign-2')),
            code('html-block', '<p>own</p>'),
          ],
        },
        { allowed, generateId: sequentialIds() },
      );

      const ids = findNodes(json, 'htmlBlock').map(
        (node) => node.attrs.htmlBlockId,
      );
      expect(ids).toEqual(allowed ? ['id-1'] : []);
      expect(blocks).toEqual(allowed ? [{ id: 'id-1', content: '<p>own</p>' }] : []);
      expect(json.content[0]).toEqual(para('kept'));
      expect(json.content[1].content[0].content).toEqual([
        { type: 'paragraph' },
      ]);
    }
  });

  it('keeps a document valid when only raw htmlBlock nodes were in it', () => {
    const footnotes = { type: 'footnotes', content: [] };

    const alone: any = convertImportedHtmlBlocks(
      { type: 'doc', content: [rawHtmlBlock('foreign')] },
      { allowed: true, generateId: sequentialIds() },
    ).json;
    const withFootnotes: any = convertImportedHtmlBlocks(
      { type: 'doc', content: [rawHtmlBlock('foreign'), footnotes] },
      { allowed: false, generateId: sequentialIds() },
    ).json;

    expect(alone.content).toEqual([{ type: 'paragraph' }]);
    expect(withFootnotes.content).toEqual([{ type: 'paragraph' }, footnotes]);
  });

  it('converts at most 500 blocks per page and stays fast with 5,000 candidates', () => {
    const doc = {
      type: 'doc',
      content: Array.from({ length: 5000 }, (_, i) =>
        code('html-block', `<p>${i}</p>`),
      ),
    };

    for (const allowed of [true, false]) {
      const started = performance.now();
      const { json, blocks }: any = convertImportedHtmlBlocks(doc, {
        allowed,
        generateId: sequentialIds(),
      });
      const elapsed = performance.now() - started;

      expect(elapsed).toBeLessThan(1000);
      expect(blocks).toHaveLength(allowed ? 500 : 0);
      expect(findNodes(json, 'htmlBlock')).toHaveLength(allowed ? 500 : 0);
      expect(codeLanguages(json).every((language) => language === 'html')).toBe(
        true,
      );
      expect(codeLanguages(json)).toHaveLength(allowed ? 4500 : 5000);
      if (allowed) {
        expect(blocks[0]).toEqual({ id: 'id-1', content: '<p>0</p>' });
        expect(blocks[499]).toEqual({ id: 'id-500', content: '<p>499</p>' });
        expect(json.content[499]).toEqual(rawHtmlBlock('id-500'));
        expect(json.content[500]).toEqual(code('html', '<p>500</p>'));
      }
    }
  });

  it('keeps code over 5 MB of utf-8 or with a NUL character as html', () => {
    const ascii = 'a'.repeat(MAX_BYTES + 1);
    const multiByte = 'é'.repeat(MAX_BYTES / 2 + 1);
    const withNul = '<p>a\u0000b</p>';
    expect(Buffer.byteLength(ascii, 'utf8')).toBe(5_242_881);
    expect(multiByte.length).toBeLessThan(MAX_BYTES);

    const { json, blocks }: any = convertImportedHtmlBlocks(
      {
        type: 'doc',
        content: [
          code('html-block', ascii),
          code('html-block', multiByte),
          code('html-block', withNul),
        ],
      },
      { allowed: true, generateId: sequentialIds() },
    );

    expect(blocks).toEqual([]);
    expect(codeLanguages(json)).toEqual(['html', 'html', 'html']);
    expect(json.content[0].content[0].text === ascii).toBe(true);
    expect(json.content[2].content[0].text).toBe(withNul);
  });

  it('turns code of exactly 5 MB into a block', () => {
    const { blocks } = convertImportedHtmlBlocks(
      { type: 'doc', content: [code('html-block', 'a'.repeat(MAX_BYTES))] },
      { allowed: true, generateId: sequentialIds() },
    );

    expect(blocks.map((b) => b.content.length)).toEqual([MAX_BYTES]);
  });

  it('keeps an empty html-block code block as html code', () => {
    const generateId = sequentialIds();

    const { json, blocks }: any = convertImportedHtmlBlocks(
      { type: 'doc', content: [code('html-block')] },
      { allowed: true, generateId },
    );

    expect(blocks).toEqual([]);
    expect(generateId).not.toHaveBeenCalled();
    expect(json.content).toEqual([code('html')]);
  });

  it('returns a document without html-block code or htmlBlock nodes as is', () => {
    const doc = {
      type: 'doc',
      content: [
        code('html', '<p>a</p>'),
        code('javascript', 'let a;'),
        code(null, 'plain'),
      ],
    };

    const { json, blocks } = convertImportedHtmlBlocks(doc, {
      allowed: true,
      generateId: sequentialIds(),
    });

    expect(json).toBe(doc);
    expect(blocks).toEqual([]);
  });

  it('does not mutate the input', () => {
    const input = {
      ...nestedImport(),
      content: [...nestedImport().content, rawHtmlBlock('foreign')],
    };
    const snapshot = JSON.stringify(input);

    convertImportedHtmlBlocks(input, {
      allowed: true,
      generateId: sequentialIds(),
    });
    convertImportedHtmlBlocks(input, {
      allowed: false,
      generateId: sequentialIds(),
    });

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('isHtmlBlocksEnabled', () => {
  const settings = (htmlBlocks: Record<string, boolean>) => ({ htmlBlocks });

  it.each([
    ['enabled', { settings: settings({ enabled: true }), disabledOnServer: false }, true],
    ['disabled', { settings: settings({ enabled: false }), disabledOnServer: false }, false],
    ['without settings', { settings: null, disabledOnServer: false }, false],
    ['disabled on the server', { settings: settings({ enabled: true }), disabledOnServer: true }, false],
  ])('%s', (_label, input, expected) => {
    expect(isHtmlBlocksEnabled(input)).toBe(expected);
  });
});

describe('canAuthorHtmlBlocks', () => {
  const settings = (htmlBlocks: Record<string, boolean>) => ({ htmlBlocks });
  const on = settings({ enabled: true });

  it.each([
    ['unlicensed', { settings: on, licensed: false, disabledOnServer: false }, false],
    ['disabled', { settings: settings({ enabled: false }), licensed: true, disabledOnServer: false }, false],
    ['without settings', { settings: null, licensed: true, disabledOnServer: false }, false],
    ['disabled on the server', { settings: on, licensed: true, disabledOnServer: true }, false],
    ['enabled and licensed', { settings: on, licensed: true, disabledOnServer: false }, true],
  ])('%s', (_label, input, expected) => {
    expect(canAuthorHtmlBlocks(input)).toBe(expected);
  });
});
