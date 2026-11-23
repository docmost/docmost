import {
  pageNodeToDocxBuffer,
  recentlyUpdatedFiltersWithinLimits,
  upgradeRecentlyUpdatedContent,
} from '@docmost/editor-ext';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as JSZip from 'jszip';
import * as Y from 'yjs';
import {
  htmlToJson,
  jsonToHtml,
  jsonToMarkdown,
  jsonToNode,
  jsonToText,
  prosemirrorNodeToYElement,
  tiptapExtensions,
  upgradeRecentlyUpdatedYdoc,
} from './collaboration.util';

const block = (attrs = '') =>
  `<div data-type="recently-updated" ${attrs}></div>`;
const spaceA = '420d0000-0000-4000-8000-000000000001';
const spaceB = '420d0000-0000-4000-8000-000000000002';

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
          scope: 'current',
          spaceIds: [],
          excludeSpaceIds: [],
          labels: [],
          excludeLabels: [],
          match: 'any',
        },
      },
    ]);
  });

  it('preserves the settings in synced blocks and both kinds of table cell after a collaborative save', () => {
    const filters = {
      scope: 'spaces',
      spaceIds: [spaceA],
      excludeSpaceIds: [spaceB],
      labels: ['+release', '-old', '?', 'r&d,review'],
      excludeLabels: ['?draft', '+review'],
      match: 'all',
    };
    const custom = block(
      `data-limit="6" data-hide-heading="true" data-scope="spaces" data-space-ids='${JSON.stringify(filters.spaceIds)}' data-exclude-space-ids='${JSON.stringify(filters.excludeSpaceIds)}' data-labels='${JSON.stringify(filters.labels)}' data-exclude-labels='${JSON.stringify(filters.excludeLabels)}' data-match="all"`,
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
      expect(html).not.toMatch(/data-(spaces|exclude-spaces|space-match)=/);
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
    ['data-space-ids', 'bad JSON'],
    ['data-exclude-space-ids', '["@self"]'],
    ['data-scope', 'invalid'],
    ['data-labels', '{"invalid":"shape"}'],
    ['data-labels', '["release",false]'],
    ['data-exclude-spaces', 'null'],
    ['data-space-match', 'some'],
    ['data-exclude-labels', 'null'],
    ['data-exclude-labels', '[""]'],
    ['data-match', 'some'],
  ])(
    'keeps malformed %s=%s from removing a restriction',
    (attribute, value) => {
      const doc = htmlToJson(block(`${attribute}='${value}'`));
      const emptySelection = { scope: 'spaces', spaceIds: [] };
      expect(doc.content[0].attrs).toMatchObject(emptySelection);
      expect(htmlToJson(jsonToHtml(doc)).content[0].attrs).toMatchObject(
        emptySelection,
      );
    },
  );

  it.each([
    { spaces: [], scope: 'current', spaceIds: [] },
    { spaces: ['@self'], scope: 'current', spaceIds: [] },
    { spaces: ['@all'], scope: 'workspace', spaceIds: [] },
    { spaces: [spaceA, spaceB], scope: 'spaces', spaceIds: [spaceA, spaceB] },
    { spaces: ['@personal'], scope: 'spaces', spaceIds: [] },
  ])(
    'upgrades saved space filters $spaces in HTML, JSON and Yjs',
    ({ spaces, scope, spaceIds }) => {
      const attrs = {
        limit: 4,
        hideHeading: true,
        spaces,
        excludeSpaces: [spaceB],
        labels: ['+review'],
      };
      const node = { type: 'recentlyUpdated', attrs };
      const authors = [spaceA, '?missing'];
      const legacyJson = {
        type: 'doc',
        content: [{ ...node, attrs: { ...attrs, authors } }],
      };
      const htmlAttrs = `data-limit="4" data-hide-heading="true" data-spaces='${JSON.stringify(spaces)}' data-exclude-spaces='${JSON.stringify([spaceB])}' data-labels='["+review"]'`;
      const expected = htmlToJson(block(htmlAttrs)).content;
      expect(expected).toMatchObject([
        {
          type: node.type,
          attrs: {
            scope,
            spaceIds,
            labels: ['+review'],
            limit: 4,
            hideHeading: true,
          },
        },
      ]);
      if (scope !== 'spaces' || spaceIds.length)
        expect(expected[0].attrs.excludeSpaceIds).toEqual([spaceB]);
      expect(expected[0].attrs).not.toHaveProperty('authors');
      expect(expected[0].attrs).not.toHaveProperty('spaces');

      expect(jsonToNode(legacyJson).toJSON().content).toEqual(expected);
      expect(
        htmlToJson(block(`${htmlAttrs} data-authors='bad JSON'`)).content,
      ).toEqual(expected);
      expect(jsonToHtml(legacyJson)).not.toContain('data-authors');
      const ydoc = new Y.Doc();
      try {
        const savedBlock = prosemirrorNodeToYElement(legacyJson.content[0]) as Y.XmlElement;
        const wrapper = new Y.XmlElement('transclusionSource');
        ydoc.getXmlFragment('default').insert(0, [wrapper]);
        wrapper.insert(0, [savedBlock]);
        upgradeRecentlyUpdatedYdoc(ydoc);
        const firstUpdate = Y.encodeStateVector(ydoc);
        upgradeRecentlyUpdatedYdoc(ydoc);
        expect(Y.encodeStateVector(ydoc)).toEqual(firstUpdate);
        expect(wrapper.get(0)).toBe(savedBlock);
        expect(savedBlock.getAttributes()).not.toHaveProperty('spaces');
        const savedJson = TiptapTransformer.fromYdoc(ydoc, 'default');
        expect(jsonToNode(savedJson).toJSON().content[0].content).toEqual(
          expected,
        );
        expect(upgradeRecentlyUpdatedContent(savedJson)).toBe(savedJson);
        expect(jsonToHtml(savedJson)).not.toContain('data-authors');
      } finally {
        ydoc.destroy();
      }
    },
  );

  it('ignores oversized legacy author filters when checking block settings', () => {
    const legacy = {
      scope: 'current' as const,
      spaceIds: [],
      labels: [],
      excludeLabels: [],
      match: 'any' as const,
      excludeSpaceIds: [],
      authors: Array(101).fill('x'.repeat(257)),
    };
    expect(recentlyUpdatedFiltersWithinLimits(legacy)).toBe(true);
    expect(
      recentlyUpdatedFiltersWithinLimits({ ...legacy, labels: legacy.authors }),
    ).toBe(false);
  });

  it('omits empty filter lists from exported HTML', () => {
    const doc = htmlToJson(block(`data-space-ids='[]' data-labels='[]'`));
    expect(jsonToHtml(doc)).not.toMatch(
      /data-(space-ids|exclude-space-ids|labels|exclude-labels|authors)=/,
    );
  });

  it.each([false, true])(
    'honors hideHeading=%s in HTML, plain text, Markdown and Word',
    async (hideHeading) => {
      const doc = htmlToJson(block(`data-hide-heading="${hideHeading}"`));
      const title = hideHeading ? '' : 'Recently updated';
      expect(jsonToHtml(doc)).toContain(`>${title}</div>`);
      expect(jsonToText(doc).trim()).toBe(title);
      expect(jsonToMarkdown(doc).trim()).toBe(title);
      const buffer = await pageNodeToDocxBuffer(
        jsonToNode(doc),
        async () => new Uint8Array(),
      );
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml.includes('Recently updated')).toBe(!hideHeading);
    },
  );
});
