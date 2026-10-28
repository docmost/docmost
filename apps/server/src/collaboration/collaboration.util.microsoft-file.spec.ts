import { JSONContent } from '@tiptap/core';
import { jsonToHtml, jsonToText } from './collaboration.util';

const webUrl =
  'https://contoso.sharepoint.com/sites/M/Shared%20Documents/Plan.docx';

const doc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'microsoftFile',
      attrs: {
        items: [
          {
            driveId: 'd',
            itemId: 'i',
            webUrl,
            name: 'Plan.docx',
          },
        ],
        display: 'embed',
        width: 800,
        height: 600,
        align: 'center',
        pendingKey: null,
      },
    },
  ],
};

describe('microsoftFile in the server tiptap extensions', () => {
  it('renders the node to html instead of throwing on an unknown node type', () => {
    const html = jsonToHtml(doc);

    expect(typeof html).toBe('string');
    expect(html).toContain(`href="${webUrl}"`);
    expect(html).toContain('Plan.docx');
  });

  it('generates search text for a page holding the node', () => {
    expect(typeof jsonToText(doc)).toBe('string');
  });
});
