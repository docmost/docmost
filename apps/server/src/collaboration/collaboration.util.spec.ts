import { addUniqueIdsToDoc } from '@docmost/editor-ext';
import { TiptapTransformer } from '@hocuspocus/transformer';
import type { JSONContent } from '@tiptap/core';
import { generateJSON } from '../common/helpers/prosemirror/html';
import { getHTMLFromFragment } from '../common/helpers/prosemirror/html/getHTMLFromFragment';
import {
  htmlToJson,
  jsonToHtml,
  jsonToMarkdown,
  jsonToNode,
  jsonToText,
  tiptapExtensions,
} from './collaboration.util';
import { PageService } from '../core/page/services/page.service';

const ID_TYPES = ['heading', 'paragraph'];

it('keeps an invisible section anchor between the same words through HTML and collaboration', () => {
  const doc = htmlToJson(
    '<p>Before<span data-type="section-anchor" data-id="checkpoint"></span>after</p>',
  );
  const inline = [
    { type: 'text', text: 'Before' },
    { type: 'sectionAnchor', attrs: { id: 'checkpoint' } },
    { type: 'text', text: 'after' },
  ];
  expect(doc.content[0].content).toMatchObject(inline);
  const ydoc = TiptapTransformer.toYdoc(doc, 'default', tiptapExtensions);
  try {
    const html = jsonToHtml(TiptapTransformer.fromYdoc(ydoc, 'default'));
    expect(html).toMatch(/\sid="checkpoint"/);
    expect(html).toContain('aria-hidden="true"');
    expect(htmlToJson(html).content[0].content).toMatchObject(inline);
  } finally {
    ydoc.destroy();
  }
});

function collectNodes(node: JSONContent, found: JSONContent[] = []) {
  found.push(node);
  node.content?.forEach((child) => collectNodes(child, found));
  return found;
}

const nodesOfType = (doc: JSONContent, types: string[]) =>
  collectNodes(doc).filter((node) => types.includes(node.type));

const withoutIds = (doc: JSONContent) =>
  JSON.parse(
    JSON.stringify(doc, (key, value) => (key === 'id' ? null : value)),
  );

describe('importing a template into an ordinary page', () => {
  const source = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Prepared for ' },
    { type: 'templateVariable', attrs: {
      id: '11111111-1111-4111-8111-111111111111', name: 'Client', fieldType: 'text', options: [],
    }, marks: [{ type: 'bold' }] },
    { type: 'text', text: '.' },
  ] }] };
  const inline = [
    { type: 'text', text: 'Prepared for ' },
    { type: 'text', text: 'Client', marks: [{ type: 'bold' }] },
    { type: 'text', text: '.' },
  ];

  it('imports the visible HTML label and keeps its formatting', () => {
    const html = jsonToHtml(source);
    expect(html).toContain('data-template-variable');
    expect(htmlToJson(html).content[0].content).toEqual(inline);
  });

  it('converts a variable in page JSON before it is saved for collaboration', async () => {
    const template = structuredClone(source);
    const result = await PageService.prototype.parseProsemirrorContent(template, 'json');
    expect(result.content[0].content).toEqual(inline);
  });
});

it('preserves template hints in collaboration and omits them from page text and exports', () => {
  const placeholder = {
    type: 'templatePlaceholder',
    attrs: { hint: 'Enter a name' },
  };
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Owner: ' }, placeholder],
      },
    ],
  };
  const ydoc = TiptapTransformer.toYdoc(doc, 'default', tiptapExtensions);
  try {
    const content = TiptapTransformer.fromYdoc(ydoc, 'default');
    expect(content.content[0].content[1]).toMatchObject(placeholder);
    expect(jsonToText(content).trim()).toBe('Owner:');
    expect(jsonToMarkdown(content).trim()).toBe('Owner:');
    expect(jsonToHtml(content)).not.toContain(placeholder.attrs.hint);
  } finally {
    ydoc.destroy();
  }
});

it('uses the HTML schema for linked prompts and preserves the link when a prompt is filled', () => {
  const source = 'https://example.com/instructions';
  const handbook = 'https://example.com/handbook';
  const link = (href: string) => [{ type: 'link', attrs: { href } }];
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Owner: ' },
          {
            type: 'templatePlaceholder',
            attrs: { hint: 'Enter an owner' },
            marks: link(source),
          },
          { type: 'text', text: ' ' },
          { type: 'text', text: 'Handbook', marks: link(handbook) },
        ],
      },
    ],
  };
  const node = jsonToNode(doc);
  const html = jsonToHtml(doc);
  expect(html).toBe(getHTMLFromFragment(node, node.type.schema));
  for (const exported of [html, jsonToMarkdown(doc), jsonToText(doc)]) {
    expect(exported).not.toContain('Enter an owner');
    expect(exported).toContain('Handbook');
  }
  expect(jsonToMarkdown(doc)).toContain(`[Handbook](${handbook})`);
  expect(doc.content[0].content[1].marks).toEqual(link(source));
  doc.content[0].content[1] = {
    type: 'text',
    text: 'Sam',
    marks: link(source),
  };
  expect(jsonToMarkdown(doc)).toContain(`[Sam](${source})`);
});

describe('addUniqueIdsToDoc', () => {
  const html = [
    '<h2>Title</h2>',
    '<p>Text with <strong>bold</strong> and <a href="https://example.com">a link</a></p>',
    '<ul><li><p>Item</p><ul><li><p>Nested item</p></li></ul></li></ul>',
    '<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>',
    '<blockquote><p>Quote</p></blockquote>',
    '<pre><code>const code = true;</code></pre>',
    '<hr>',
  ].join('');
  const doc = generateJSON(html, tiptapExtensions);

  it('gives every heading and paragraph an id, at any depth', () => {
    const result = addUniqueIdsToDoc(doc, tiptapExtensions);

    const nodes = nodesOfType(result, ID_TYPES);
    expect(nodes).toHaveLength(6);
    nodes.forEach((node) => expect(node.attrs.id).toEqual(expect.any(String)));
  });

  it('gives every node a different id', () => {
    const result = addUniqueIdsToDoc(doc, tiptapExtensions);

    const ids = nodesOfType(result, ID_TYPES).map((node) => node.attrs.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps an id that is already there', () => {
    const withId = JSON.parse(JSON.stringify(doc));
    nodesOfType(withId, ['heading'])[0].attrs.id = 'existing-id';

    const result = addUniqueIdsToDoc(withId, tiptapExtensions);

    expect(nodesOfType(result, ['heading'])[0].attrs.id).toBe('existing-id');
  });

  it('leaves everything else in the document as it was', () => {
    const result = addUniqueIdsToDoc(doc, tiptapExtensions);

    expect(withoutIds(result)).toEqual(withoutIds(doc));
  });

  it('adds no id to other node types', () => {
    const result = addUniqueIdsToDoc(doc, tiptapExtensions);

    const others = collectNodes(result).filter(
      (node) => !ID_TYPES.includes(node.type),
    );
    expect(others.length).toBeGreaterThan(0);
    others.forEach((node) => expect(node.attrs?.id).toBeUndefined());
  });

  it('does not change the document it is given', () => {
    const input = generateJSON(html, tiptapExtensions);
    const before = JSON.stringify(input);

    addUniqueIdsToDoc(input, tiptapExtensions);

    expect(JSON.stringify(input)).toBe(before);
  });

  it('throws when the UniqueID extension is missing', () => {
    const extensions = tiptapExtensions.filter(
      (extension) => extension.name !== 'uniqueID',
    );

    expect(() => addUniqueIdsToDoc(doc, extensions)).toThrow(
      'UniqueID extension not found',
    );
  });

  it('handles a very long document in well under a second', () => {
    const longDoc = {
      type: 'doc',
      content: Array.from({ length: 10000 }, () => ({
        type: 'paragraph',
        content: [{ type: 'text', text: 'a' }],
      })),
    };

    const started = performance.now();
    const result = addUniqueIdsToDoc(longDoc, tiptapExtensions);
    const elapsed = performance.now() - started;

    expect(nodesOfType(result, ['paragraph'])).toHaveLength(10000);
    expect(elapsed).toBeLessThan(1000);
  });
});

it('keeps private label block headings and filters out of indexed text', () => {
  const content = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Published introduction' }] },
      { type: 'itemsByLabel', attrs: { heading: 'Internal handbook', labels: ['private-tag'] } },
    ],
  };
  expect(jsonToText(content).trim()).toBe('Published introduction');
});
