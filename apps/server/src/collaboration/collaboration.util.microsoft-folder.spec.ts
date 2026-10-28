import { JSONContent } from '@tiptap/core';
import { jsonToHtml, jsonToText } from './collaboration.util';

const webUrl =
  'https://contoso.sharepoint.com/sites/M/Shared%20Documents/Reports';

const doc = (attrs: Record<string, string>): JSONContent => ({
  type: 'doc',
  content: [{ type: 'microsoftFolder', attrs }],
});

describe('microsoftFolder in the server tiptap extensions', () => {
  it('renders the node to html with a link to the folder', () => {
    const html = jsonToHtml(
      doc({ driveId: 'd', itemId: 'f', webUrl, name: 'Reports' }),
    );

    expect(html).toContain('data-type="microsoftFolder"');
    expect(html).toContain('data-item-id="f"');
    expect(html).toContain(`href="${webUrl}"`);
    expect(html).toContain('Reports');
  });

  it('drops a non-https folder url', () => {
    const html = jsonToHtml(
      doc({
        driveId: 'd',
        itemId: 'f',
        webUrl: 'javascript:alert(1)',
        name: 'Reports',
      }),
    );

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a');
    expect(html).toContain('Reports');
  });

  it('generates search text for a page holding the node', () => {
    const text = jsonToText(
      doc({ driveId: 'd', itemId: 'f', webUrl, name: 'Reports' }),
    );

    expect(typeof text).toBe('string');
  });
});
