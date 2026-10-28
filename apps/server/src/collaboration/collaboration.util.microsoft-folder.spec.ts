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

  it('drops a folder url outside SharePoint', () => {
    const html = jsonToHtml(
      doc({
        driveId: 'd',
        itemId: 'f',
        webUrl: 'https://contoso.sharepoint.com.evil.example/a',
        name: 'Reports',
      }),
    );

    expect(html).not.toContain('evil.example');
    expect(html).not.toContain('<a');
    expect(html).toContain('Reports');
  });

  it('keeps percent-encoded characters in the folder url', () => {
    const encodedUrl =
      'https://contoso.sharepoint.com/sites/M/Shared%20Documents/C%23%20notes';
    const html = jsonToHtml(
      doc({ driveId: 'd', itemId: 'f', webUrl: encodedUrl, name: 'C# notes' }),
    );

    expect(html).toContain(`href="${encodedUrl}"`);
    expect(html).toContain(`data-web-url="${encodedUrl}"`);
  });

  it('generates search text containing the folder name', () => {
    const text = jsonToText(
      doc({ driveId: 'd', itemId: 'f', webUrl, name: 'Reports' }),
    );

    expect(text).toContain('Reports');
  });

  it('falls back to the folder url for search text and never to an unsafe one', () => {
    const unnamed = jsonToText(
      doc({ driveId: 'd', itemId: 'f', webUrl, name: '' }),
    );
    const unsafe = jsonToText(
      doc({
        driveId: 'd',
        itemId: 'f',
        webUrl: 'javascript:alert(1)',
        name: '',
      }),
    );

    expect(unnamed).toContain(webUrl);
    expect(unsafe).not.toContain('javascript:');
  });
});
