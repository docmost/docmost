import {
  pageNodeToDocxBuffer,
  recentlyUpdatedFiltersWithinLimits,
} from '@docmost/editor-ext';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as JSZip from 'jszip';
import type { XmlElement } from 'yjs';
import {
  htmlToJson,
  jsonToHtml,
  jsonToMarkdown,
  jsonToNode,
  jsonToText,
  tiptapExtensions,
} from './collaboration.util';

const block = (attrs = '') =>
  `<div data-type="recently-updated" ${attrs}></div>`;

describe('recently updated block', () => {
  it.each([
    ['', 15],
    ['data-limit="8"', 8],
    ['data-limit="0"', 1],
    ['data-limit="201"', 200],
    ['data-limit="1.5"', 15],
    ['data-limit="many"', 15],
    ['data-limit="" data-hide-heading="false"', 15],
  ])('imports %s with a bounded page count', (attrs: string, limit: number) => {
    expect(htmlToJson(block(attrs)).content).toMatchObject([
      {
        type: 'recentlyUpdated',
        attrs: {
          limit,
          hideHeading: false,
          spaces: [],
          labels: [],
        },
      },
    ]);
  });

  it('preserves the settings in synced blocks and both kinds of table cell after a collaborative save', () => {
    const filters = {
      spaces: ['@self', '+OPS', '-ARCHIVE'],
      labels: ['+release', '-old', 'r&d,review'],
    };
    const custom = block(
      `data-limit="6" data-hide-heading="true" data-spaces='${JSON.stringify(filters.spaces)}' data-labels='${JSON.stringify(filters.labels)}'`,
    );
    const doc = htmlToJson(
      `<div data-type="transclusionSource">${custom}<table><tr><th>${custom}</th><td>${custom}</td></tr></table></div>`,
    );
    const ydoc = TiptapTransformer.toYdoc(doc, 'default', tiptapExtensions);
    try {
      const saved = TiptapTransformer.fromYdoc(ydoc, 'default');
      const html = jsonToHtml(saved);
      expect(html).toContain('data-type="recently-updated"');
      expect(html).toContain('data-limit="6"');
      expect(html).toContain('data-hide-heading="true"');
      const expected = {
        type: 'recentlyUpdated',
        attrs: { limit: 6, hideHeading: true, ...filters },
      };
      expect(htmlToJson(html).content).toMatchObject([
        {
          type: 'transclusionSource',
          content: [
            expected,
            {
              type: 'table',
              content: [
                {
                  type: 'tableRow',
                  content: [
                    { type: 'tableHeader', content: [expected] },
                    { type: 'tableCell', content: [expected] },
                  ],
                },
              ],
            },
          ],
        },
      ]);
    } finally {
      ydoc.destroy();
    }
  });

  it.each([
    ['data-spaces', 'bad JSON', 'spaces'],
    ['data-labels', '{"invalid":"shape"}', 'labels'],
    ['data-labels', '["release",false]', 'labels'],
  ])(
    'keeps malformed %s=%s from removing a restriction',
    (attribute, value, name) => {
      const doc = htmlToJson(block(`${attribute}='${value}'`));
      expect(doc.content[0].attrs[name]).toEqual(['?']);
      expect(htmlToJson(jsonToHtml(doc)).content[0].attrs[name]).toEqual(['?']);
    },
  );

  it('drops legacy author filters from saved JSON and imported HTML', () => {
    const attrs = {
      limit: 4,
      hideHeading: true,
      spaces: ['@all'],
      labels: ['+review'],
    };
    const node = { type: 'recentlyUpdated', attrs };
    const authors = ['420d0000-0000-4000-8000-000000000001', '?missing'];
    const legacyJson = {
      type: 'doc',
      content: [{ ...node, attrs: { ...attrs, authors } }],
    };
    const htmlAttrs = `data-limit="4" data-hide-heading="true" data-spaces='["@all"]' data-labels='["+review"]'`;
    const expected = htmlToJson(block(htmlAttrs)).content;
    expect(expected).toMatchObject([node]);
    expect(expected[0].attrs).not.toHaveProperty('authors');

    expect(jsonToNode(legacyJson).toJSON().content).toEqual(expected);
    expect(
      htmlToJson(block(`${htmlAttrs} data-authors='bad JSON'`)).content,
    ).toEqual(expected);
    expect(jsonToHtml(legacyJson)).not.toContain('data-authors');
    const ydoc = TiptapTransformer.toYdoc(
      legacyJson,
      'default',
      tiptapExtensions,
    );
    try {
      expect(TiptapTransformer.fromYdoc(ydoc, 'default').content).toEqual(
        expected,
      );
      const savedBlock = ydoc.getXmlFragment('default').get(0) as XmlElement<{
        authors: string[];
      }>;
      savedBlock.setAttribute('authors', authors);
      const savedJson = TiptapTransformer.fromYdoc(ydoc, 'default');
      expect(jsonToNode(savedJson).toJSON().content).toEqual(expected);
      expect(jsonToHtml(savedJson)).not.toContain('data-authors');
    } finally {
      ydoc.destroy();
    }
  });

  it('ignores oversized legacy author filters when checking block settings', () => {
    const legacy = {
      spaces: ['@self'],
      labels: [],
      authors: Array(101).fill('x'.repeat(257)),
    };
    expect(recentlyUpdatedFiltersWithinLimits(legacy)).toBe(true);
    expect(
      recentlyUpdatedFiltersWithinLimits({ ...legacy, labels: legacy.authors }),
    ).toBe(false);
  });

  it('omits empty filter lists from exported HTML', () => {
    const doc = htmlToJson(block(`data-spaces='[]' data-labels='[]'`));
    expect(jsonToHtml(doc)).not.toMatch(/data-(spaces|labels|authors)=/);
  });

  it('exports a static title in HTML, plain text, Markdown and Word', async () => {
    const doc = htmlToJson(block());
    expect(jsonToHtml(doc)).toContain('>Recently updated</div>');
    expect(jsonToText(doc).trim()).toBe('Recently updated');
    expect(jsonToMarkdown(doc).trim()).toBe('Recently updated');
    const buffer = await pageNodeToDocxBuffer(
      jsonToNode(doc),
      async () => new Uint8Array(),
    );
    const zip = await JSZip.loadAsync(buffer);
    expect(await zip.file('word/document.xml')!.async('string')).toContain(
      'Recently updated',
    );
  });
});
