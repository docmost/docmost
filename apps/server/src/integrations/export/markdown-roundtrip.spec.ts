import { getSchema, JSONContent } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { markdownToHtml } from '@docmost/editor-ext';
import {
  htmlToJson,
  jsonToMarkdown,
  tiptapExtensions,
} from '../../collaboration/collaboration.util';

/**
 * Markdown round-trip coverage for the Docmost document model.
 *
 * Every markdown entrypoint on the server (page export, REST `format=markdown`
 * reads/writes, file import, and the MCP server built on top of them) funnels
 * through the same two conversions exercised here:
 *
 *   export: jsonToMarkdown(doc)                     (jsonToHtml -> turndown)
 *   import: htmlToJson(await markdownToHtml(md))   (marked -> generateJSON)
 *
 * Each fixture isolates one node, mark or attribute so a failure names the
 * exact content type that loses data.
 */

const schema = getSchema(tiptapExtensions);

const FILE = '0198a3b0-1c2d-7e3f-8a9b-0c1d2e3f4a5b';
const USER = '0198a3b0-0000-7000-8000-000000000001';
const PAGE = '0198a3b0-0000-7000-8000-000000000002';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const doc = (...content: JSONContent[]): JSONContent => ({
  type: 'doc',
  content,
});

const n = (
  type: string,
  attrs?: Record<string, any> | null,
  ...content: JSONContent[]
): JSONContent => ({
  type,
  ...(attrs ? { attrs } : {}),
  ...(content.length ? { content } : {}),
});

const t = (text: string, ...marks: any[]): JSONContent => ({
  type: 'text',
  text,
  ...(marks.length ? { marks } : {}),
});

const mk = (type: string, attrs?: Record<string, any>) =>
  attrs ? { type, attrs } : { type };

const p = (...content: JSONContent[]) => n('paragraph', null, ...content);
const h = (level: number, ...content: JSONContent[]) =>
  n('heading', { level }, ...content);
const li = (...content: JSONContent[]) => n('listItem', null, ...content);
const ul = (...items: JSONContent[]) => n('bulletList', null, ...items);
const ol = (attrs: Record<string, any> | null, ...items: JSONContent[]) =>
  n('orderedList', attrs, ...items);
const task = (checked: boolean, ...content: JSONContent[]) =>
  n('taskItem', { checked }, ...content);
const td = (attrs: Record<string, any> | null, ...content: JSONContent[]) =>
  n('tableCell', attrs, ...content);
const th = (attrs: Record<string, any> | null, ...content: JSONContent[]) =>
  n('tableHeader', attrs, ...content);
const tr = (...cells: JSONContent[]) => n('tableRow', null, ...cells);
const table = (...rows: JSONContent[]) => n('table', null, ...rows);
const cell = (text: string) => td(null, p(t(text)));
const hcell = (text: string) => th(null, p(t(text)));

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

// Validate against the schema and fill in every default attribute.
function canonical(json: JSONContent): JSONContent {
  const node = Node.fromJSON(schema, json);
  node.check();
  return node.toJSON();
}

/**
 * Strip attributes that are expected to differ between two otherwise identical
 * documents:
 * - `dir`: server-only TextDirection attribute, always "auto".
 * - paragraph / heading `id`: UniqueID, regenerated on every import.
 * - footnote ids: regenerated on import; linkage is compared positionally.
 */
function normalize(json: JSONContent): JSONContent {
  const footnoteIds = new Map<string, string>();
  const remap = (id: string) => {
    if (!footnoteIds.has(id)) footnoteIds.set(id, `fn-${footnoteIds.size + 1}`);
    return footnoteIds.get(id);
  };

  const walk = (node: any): any => {
    const out: any = { ...node };
    if (node.attrs) {
      const attrs = { ...node.attrs };
      delete attrs.dir;
      if (node.type === 'paragraph' || node.type === 'heading') delete attrs.id;
      if (node.type === 'footnote' || node.type === 'footnoteReference') {
        if (attrs['data-id']) attrs['data-id'] = remap(attrs['data-id']);
        if (node.type === 'footnote' && attrs.id) delete attrs.id;
      }
      if (Object.keys(attrs).length) out.attrs = attrs;
      else delete out.attrs;
    }
    if (node.content) out.content = node.content.map(walk);
    return out;
  };

  return walk(canonical(json));
}

async function importMarkdown(md: string): Promise<JSONContent> {
  const html = await markdownToHtml(md);
  return htmlToJson(html as string);
}

function collectTypes(json: any, into = new Set<string>()): Set<string> {
  if (!json || typeof json !== 'object') return into;
  if (json.type) into.add(json.type);
  for (const m of json.marks ?? []) into.add(`mark:${m.type}`);
  for (const c of json.content ?? []) collectTypes(c, into);
  return into;
}

// ---------------------------------------------------------------------------
// Fixtures: one content type / attribute per case
// ---------------------------------------------------------------------------

type Case = [name: string, fixture: JSONContent];

const cases: Case[] = [
  // --- Text blocks --------------------------------------------------------
  ['paragraph: plain text', doc(p(t('Hello world')))],
  ['paragraph: multiple paragraphs', doc(p(t('One')), p(t('Two')))],
  [
    'paragraph: empty paragraph between paragraphs',
    doc(p(t('Before')), p(), p(t('After'))),
  ],
  [
    'paragraph: textAlign center',
    doc(n('paragraph', { textAlign: 'center' }, t('Centered'))),
  ],
  [
    'paragraph: indent',
    doc(n('paragraph', { indent: 2 }, t('Indented'))),
  ],
  [
    'paragraph: markdown special characters are literal',
    doc(p(t('Use * and _ and # and [x] and | pipes and ~tilde~ and 1. dot'))),
  ],
  [
    'paragraph: html-looking text is literal',
    doc(p(t('Type <div class="x"> and &amp; literally'))),
  ],
  [
    'paragraph: unicode and emoji',
    doc(p(t('Héllo — “quotes” ‘single’ … 😀 ©'))),
  ],
  [
    'hardBreak inside paragraph',
    doc(p(t('Line one'), n('hardBreak'), t('Line two'))),
  ],
  [
    'heading: levels 1-6',
    doc(
      h(1, t('H1')),
      h(2, t('H2')),
      h(3, t('H3')),
      h(4, t('H4')),
      h(5, t('H5')),
      h(6, t('H6')),
    ),
  ],
  [
    'heading: textAlign right',
    doc(n('heading', { level: 2, textAlign: 'right' }, t('Right'))),
  ],
  [
    'heading: indent',
    doc(n('heading', { level: 3, indent: 1 }, t('Indented heading'))),
  ],
  [
    'blockquote: multiple paragraphs',
    doc(n('blockquote', null, p(t('Quote one')), p(t('Quote two')))),
  ],
  [
    'blockquote: nested list',
    doc(n('blockquote', null, ul(li(p(t('a'))), li(p(t('b')))))),
  ],
  ['horizontalRule between paragraphs', doc(p(t('Above')), n('horizontalRule'), p(t('Below')))],
  [
    'horizontalRule as first block',
    doc(n('horizontalRule'), p(t('After rule')), n('horizontalRule'), p(t('End'))),
  ],

  // --- Lists ---------------------------------------------------------------
  ['bulletList: flat', doc(ul(li(p(t('a'))), li(p(t('b'))), li(p(t('c')))))],
  [
    'bulletList: nested',
    doc(
      ul(
        li(
          p(t('parent')),
          ul(li(p(t('child')), ul(li(p(t('grandchild')))))),
        ),
      ),
    ),
  ],
  [
    'bulletList: item with two paragraphs',
    doc(ul(li(p(t('first para')), p(t('second para'))))),
  ],
  ['orderedList: default start', doc(ol(null, li(p(t('one'))), li(p(t('two')))))],
  ['orderedList: start 3', doc(ol({ start: 3 }, li(p(t('three'))), li(p(t('four')))))],
  [
    'orderedList: nested inside bulletList',
    doc(ul(li(p(t('bullet')), ol(null, li(p(t('num 1'))), li(p(t('num 2'))))))),
  ],
  [
    'orderedList: item with nested list',
    doc(ol(null, li(p(t('first')), ul(li(p(t('nested a'))), li(p(t('nested b'))))), li(p(t('second'))))),
  ],
  [
    'orderedList: item with two paragraphs',
    doc(ol({ start: 9 }, li(p(t('nine')), p(t('nine more'))), li(p(t('ten'))))),
  ],
  [
    'taskList: checked and unchecked',
    doc(n('taskList', null, task(true, p(t('done'))), task(false, p(t('todo'))))),
  ],
  [
    'taskList: item with marks and link',
    doc(
      n(
        'taskList',
        null,
        task(
          false,
          p(
            t('bold', mk('bold')),
            t(' and '),
            t('link', mk('link', { href: 'https://example.com' })),
          ),
        ),
      ),
    ),
  ],
  [
    'taskList: nested task list',
    doc(
      n(
        'taskList',
        null,
        task(false, p(t('parent')), n('taskList', null, task(true, p(t('child'))))),
      ),
    ),
  ],

  // --- Code ----------------------------------------------------------------
  [
    'codeBlock: with language',
    doc(n('codeBlock', { language: 'typescript' }, t('const a: number = 1;\nconsole.log(a);'))),
  ],
  ['codeBlock: no language', doc(n('codeBlock', null, t('plain code')))],
  [
    'codeBlock: markdown and html characters inside',
    doc(n('codeBlock', { language: 'html' }, t('<div>*not bold*</div>\n<br>\n# not heading'))),
  ],
  [
    'codeBlock: contains triple backticks',
    doc(n('codeBlock', { language: 'markdown' }, t('```js\nx\n```'))),
  ],
  [
    'codeBlock: leading and trailing blank lines',
    doc(n('codeBlock', null, t('\nmiddle\n'))),
  ],
  [
    'codeBlock: mermaid',
    doc(n('codeBlock', { language: 'mermaid' }, t('graph TD;\n  A-->B;'))),
  ],

  // --- Marks ---------------------------------------------------------------
  ['mark: bold', doc(p(t('a '), t('bold', mk('bold')), t(' b')))],
  ['mark: italic', doc(p(t('a '), t('italic', mk('italic')), t(' b')))],
  ['mark: underline', doc(p(t('a '), t('under', mk('underline')), t(' b')))],
  ['mark: strike', doc(p(t('a '), t('gone', mk('strike')), t(' b')))],
  ['mark: code', doc(p(t('run '), t('npm test', mk('code')), t(' now')))],
  ['mark: code containing backtick', doc(p(t('a `b` c', mk('code'))))],
  ['mark: subscript', doc(p(t('H'), t('2', mk('subscript')), t('O')))],
  ['mark: superscript', doc(p(t('x'), t('2', mk('superscript'))))],
  ['mark: bold + italic', doc(p(t('both', mk('bold'), mk('italic'))))],
  [
    'mark: bold adjacent to word characters',
    doc(p(t('pre'), t('bold', mk('bold')), t('post'))),
  ],
  [
    'mark: link',
    doc(p(t('see '), t('example', mk('link', { href: 'https://example.com/a?b=1' })))),
  ],
  [
    'mark: link with title',
    doc(p(t('titled', mk('link', { href: 'https://example.com', title: 'Example' })))),
  ],
  [
    'mark: internal link',
    doc(p(t('page', mk('link', { href: '/s/eng/p/roadmap-abc123', internal: true })))),
  ],
  ['mark: highlight', doc(p(t('a '), t('marked', mk('highlight')), t(' b')))],
  [
    'mark: highlight with color',
    doc(p(t('yellow', mk('highlight', { color: '#fef08a', colorName: 'yellow' })))),
  ],
  [
    'mark: textStyle color',
    doc(p(t('red', mk('textStyle', { color: '#ff0000' })))),
  ],
  [
    'mark: comment',
    doc(p(t('a '), t('commented', mk('comment', { commentId: FILE, resolved: false })), t(' b'))),
  ],

  // --- Inline atoms --------------------------------------------------------
  [
    'mention: user',
    doc(
      p(
        t('Hi '),
        n('mention', {
          id: 'm1',
          label: 'Alice',
          entityType: 'user',
          entityId: USER,
          creatorId: USER,
        }),
      ),
    ),
  ],
  [
    'mention: page',
    doc(
      p(
        t('See '),
        n('mention', {
          id: 'm2',
          label: 'Roadmap',
          entityType: 'page',
          entityId: PAGE,
          slugId: 'abc123',
          creatorId: USER,
        }),
      ),
    ),
  ],
  [
    'status',
    doc(p(t('State: '), n('status', { text: 'In progress', color: 'blue' }))),
  ],
  ['mathInline: simple', doc(p(t('Energy '), n('mathInline', { text: 'E = mc^2' })))],
  [
    'mathInline: latex special characters',
    doc(p(n('mathInline', { text: 'a_b * c < d \\frac{1}{2} & e' }))),
  ],

  // --- Math / callout / details -------------------------------------------
  ['mathBlock', doc(n('mathBlock', { text: '\\int_0^1 x^2 \\, dx' }))],
  [
    'mathBlock: underscores and asterisks',
    doc(n('mathBlock', { text: 'x_1 * y_2 = z_{3}' })),
  ],
  ...(['info', 'success', 'warning', 'danger', 'note', 'default'].map(
    (type): Case => [
      `callout: type ${type}`,
      doc(n('callout', { type }, p(t(`A ${type} callout`)))),
    ],
  )),
  [
    'callout: custom icon',
    doc(n('callout', { type: 'info', icon: '🚀' }, p(t('Launch')))),
  ],
  [
    'callout: list inside',
    doc(n('callout', { type: 'warning' }, p(t('Watch out:')), ul(li(p(t('one'))), li(p(t('two')))))),
  ],
  [
    'details: closed',
    doc(
      n(
        'details',
        null,
        n('detailsSummary', null, t('Summary')),
        n('detailsContent', null, p(t('Hidden content'))),
      ),
    ),
  ],
  [
    'details: open',
    doc(
      n(
        'details',
        { open: true },
        n('detailsSummary', null, t('Open summary')),
        n('detailsContent', null, p(t('Visible content'))),
      ),
    ),
  ],
  [
    'details: marks in summary and list in content',
    doc(
      n(
        'details',
        null,
        n('detailsSummary', null, t('Bold', mk('bold')), t(' summary')),
        n('detailsContent', null, ul(li(p(t('x'))), li(p(t('y'))))),
      ),
    ),
  ],

  // --- Tables --------------------------------------------------------------
  [
    'table: header row',
    doc(table(tr(hcell('A'), hcell('B')), tr(cell('1'), cell('2')))),
  ],
  [
    'table: no header row',
    doc(table(tr(cell('1'), cell('2')), tr(cell('3'), cell('4')))),
  ],
  [
    'table: header column',
    doc(table(tr(hcell('Row1'), cell('a')), tr(hcell('Row2'), cell('b')))),
  ],
  [
    'table: colspan',
    doc(
      table(
        tr(th({ colspan: 2 }, p(t('Wide header')))),
        tr(cell('a'), cell('b')),
      ),
    ),
  ],
  [
    'table: rowspan',
    doc(
      table(
        tr(hcell('A'), hcell('B')),
        tr(td({ rowspan: 2 }, p(t('tall'))), cell('b1')),
        tr(cell('b2')),
      ),
    ),
  ],
  [
    'table: cell background color',
    doc(
      table(
        tr(hcell('A')),
        tr(td({ backgroundColor: '#fde2e2', backgroundColorName: 'red' }, p(t('red cell')))),
      ),
    ),
  ],
  [
    'table: column widths',
    doc(
      table(
        tr(th({ colwidth: [150] }, p(t('A'))), th({ colwidth: [300] }, p(t('B')))),
        tr(td({ colwidth: [150] }, p(t('1'))), td({ colwidth: [300] }, p(t('2')))),
      ),
    ),
  ],
  [
    'table: cell alignment',
    doc(
      table(
        tr(th({ align: 'center' }, p(t('Center'))), th({ align: 'right' }, p(t('Right')))),
        tr(td({ align: 'center' }, p(t('c'))), td({ align: 'right' }, p(t('r')))),
      ),
    ),
  ],
  [
    'table: marks and pipe character in cells',
    doc(
      table(
        tr(hcell('A'), hcell('B')),
        tr(td(null, p(t('bold', mk('bold')))), td(null, p(t('a | b')))),
      ),
    ),
  ],
  [
    'table: list inside cell',
    doc(
      table(
        tr(hcell('A')),
        tr(td(null, ul(li(p(t('x'))), li(p(t('y')))))),
      ),
    ),
  ],
  [
    'table: code block with blank line inside cell',
    doc(table(tr(hcell('A')), tr(td(null, n('codeBlock', null, t('one\n\ntwo')))))),
  ],
  [
    'table: hard break in cell',
    doc(table(tr(hcell('A')), tr(td(null, p(t('one'), n('hardBreak'), t('two')))))),
  ],
  [
    'table: multiple paragraphs in cell',
    doc(table(tr(hcell('A')), tr(td(null, p(t('one')), p(t('two')))))),
  ],

  // --- Media / attachments ------------------------------------------------
  [
    'image: external with alt',
    doc(n('image', { src: 'https://example.com/cat.png', alt: 'A cat' })),
  ],
  [
    'image: external with width and align',
    doc(n('image', { src: 'https://example.com/cat.png', alt: 'cat', width: 400, align: 'left' })),
  ],
  [
    'image: internal attachment',
    doc(
      n('image', {
        src: `/api/files/${FILE}/cat.png`,
        alt: 'cat',
        attachmentId: FILE,
        width: 300,
        align: 'right',
        size: 12345,
        aspectRatio: 1.5,
      }),
    ),
  ],
  ['video: external', doc(n('video', { src: 'https://example.com/clip.mp4' }))],
  [
    'video: internal attachment',
    doc(
      n('video', {
        src: `/api/files/${FILE}/clip.mp4`,
        attachmentId: FILE,
        size: 99999,
        width: 640,
        align: 'center',
      }),
    ),
  ],
  [
    'youtube',
    // Stored in watch form; rendered as an embed URL.
    doc(n('youtube', { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })),
  ],
  [
    'audio: internal attachment',
    doc(n('audio', { src: `/api/files/${FILE}/song.mp3`, attachmentId: FILE, size: 2048 })),
  ],
  [
    'pdf',
    doc(
      n('pdf', {
        src: `/api/files/${FILE}/doc.pdf`,
        name: 'doc.pdf',
        attachmentId: FILE,
        size: 5000,
        width: 800,
        height: 600,
      }),
    ),
  ],
  [
    'attachment',
    doc(
      n('attachment', {
        url: `/api/files/${FILE}/report.zip`,
        name: 'report.zip',
        mime: 'application/zip',
        size: 4096,
        attachmentId: FILE,
      }),
    ),
  ],
  [
    'drawio',
    doc(
      n('drawio', {
        src: `/api/files/${FILE}/diagram.drawio.svg`,
        title: 'diagram',
        width: 640,
        height: 480,
        size: 1000,
        align: 'center',
        attachmentId: FILE,
      }),
    ),
  ],
  [
    'excalidraw',
    doc(
      n('excalidraw', {
        src: `/api/files/${FILE}/sketch.excalidraw.svg`,
        title: 'sketch',
        width: 500,
        height: 300,
        size: 800,
        align: 'left',
        attachmentId: FILE,
      }),
    ),
  ],
  [
    'embed',
    doc(
      n('embed', {
        src: 'https://www.figma.com/file/abc',
        provider: 'figma',
        align: 'center',
        width: 800,
        height: 600,
      }),
    ),
  ],
  ['base embed', doc(n('base', { pageId: PAGE }))],

  // --- Layout / structural -------------------------------------------------
  [
    'columns: two equal',
    doc(
      n(
        'columns',
        { layout: 'two_equal' },
        n('column', null, p(t('Left'))),
        n('column', null, p(t('Right'))),
      ),
    ),
  ],
  [
    'columns: wide with column widths and markdown content',
    doc(
      n(
        'columns',
        { layout: 'two_left_wide', widthMode: 'wide' },
        n('column', { width: 66 }, h(2, t('Title')), p(t('bold', mk('bold')))),
        n('column', { width: 34 }, ul(li(p(t('item'))))),
      ),
    ),
  ],
  ['pageBreak', doc(p(t('Page 1')), n('pageBreak'), p(t('Page 2')))],
  ['subpages', doc(n('subpages'))],
  [
    'transclusionSource',
    doc(n('transclusionSource', { id: 'ts-source-1' }, p(t('Shared content')))),
  ],
  [
    'transclusionReference',
    doc(n('transclusionReference', { sourcePageId: PAGE, transclusionId: 'ts-source-1' })),
  ],
];

// Footnotes carry generated linkage ids, so the fixture is built by the
// importer itself rather than by hand.
const FOOTNOTES_MD = 'Claim one[^1] and claim two[^2].\n\n[^1]: First note.\n[^2]: Second note.';

/**
 * Hand-written markdown as an API / MCP client would send it. These must reach
 * a fixed point: md -> doc -> md -> doc yields the same document twice.
 */
const authoredMarkdown: [string, string][] = [
  ['front matter is stripped, body kept', '---\ntitle: x\n---\n\n# Title\n\nBody'],
  ['gfm table with alignment', '| L | C | R |\n|:--|:-:|--:|\n| a | b | c |'],
  ['nested list with 4-space indent', '- a\n    - b\n        - c'],
  ['asterisk bullets and underscore emphasis', '* one\n* two\n\n_em_ and __strong__'],
  ['autolink', 'Visit <https://example.com> now'],
  ['inline html br', 'one<br>two'],
  ['setext heading', 'Title\n=====\n\ntext'],
  ['indented code block', 'para\n\n    code line'],
  ['task list', '- [ ] todo\n- [x] done'],
  ['callout', ':::warning\nCareful **now**\n:::'],
  ['math', 'Inline $a^2$ and\n\n$$\nb^2\n$$'],
  ['highlight syntax', 'some ==highlighted== text'],
  ['strikethrough', 'some ~~old~~ text'],
  ['image with title', '![alt text](https://example.com/a.png "Title")'],
  ['horizontal rule between paragraphs', 'Above\n\n---\n\nBelow'],
  ['horizontal rule first line', '---\n\nAfter rule'],
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('markdown round-trip: doc -> markdown -> doc', () => {
  describe.each(cases)('%s', (_name, fixture) => {
    it('fixture is valid for the schema', () => {
      expect(() => canonical(fixture)).not.toThrow();
    });

    it('preserves content and attributes', async () => {
      const md = jsonToMarkdown(fixture);
      const back = await importMarkdown(md);
      expect({ md, doc: normalize(back) }).toEqual({
        md,
        doc: normalize(fixture),
      });
    });

    it('markdown is stable on second export', async () => {
      const md1 = jsonToMarkdown(fixture);
      const md2 = jsonToMarkdown(await importMarkdown(md1));
      expect(md2).toBe(md1);
    });
  });

  describe('footnotes', () => {
    it('preserves references and definitions', async () => {
      const fixture = await importMarkdown(FOOTNOTES_MD);
      const md = jsonToMarkdown(fixture);
      const back = await importMarkdown(md);
      expect({ md, doc: normalize(back) }).toEqual({
        md,
        doc: normalize(fixture),
      });
      expect([...collectTypes(fixture)]).toEqual(
        expect.arrayContaining(['footnotes', 'footnote', 'footnoteReference']),
      );
    });
  });
});

describe('markdown round-trip: authored markdown reaches a fixed point', () => {
  it.each(authoredMarkdown)('%s', async (_name, md) => {
    const doc1 = await importMarkdown(md);
    const md2 = jsonToMarkdown(doc1);
    const doc2 = await importMarkdown(md2);
    expect({ md2, doc: normalize(doc2) }).toEqual({
      md2,
      doc: normalize(doc1),
    });
  });

  it('a leading horizontal rule does not swallow content', async () => {
    const doc1 = await importMarkdown('---\n\nKeep me\n\n---\n\nAnd me');
    const text = JSON.stringify(doc1);
    expect(text).toContain('Keep me');
    expect(text).toContain('And me');
  });
});

describe('markdown round-trip: coverage', () => {
  it('every node and mark type in the schema has a fixture', async () => {
    const covered = new Set<string>();
    for (const [, fixture] of cases) collectTypes(fixture, covered);
    collectTypes(await importMarkdown(FOOTNOTES_MD), covered);

    const expected = [
      ...Object.keys(schema.nodes).filter((n) => n !== 'doc' && n !== 'text'),
      ...Object.keys(schema.marks).map((m) => `mark:${m}`),
    ];
    const missing = expected.filter((type) => !covered.has(type));
    expect(missing).toEqual([]);
  });
});
