import { JSONContent } from '@tiptap/core';
import {
  htmlToJson,
  jsonToHtml,
  jsonToMarkdown,
  jsonToText,
} from './collaboration.util';

const webUrl =
  'https://contoso.sharepoint.com/sites/M/Shared%20Documents/Plan.docx';
const budgetUrl =
  'https://contoso.sharepoint.com/sites/M/Shared%20Documents/Budget.xlsx';

const plan = { driveId: 'd', itemId: 'i', webUrl, name: 'Plan.docx' };
const budget = {
  driveId: 'd',
  itemId: 'b',
  webUrl: budgetUrl,
  name: 'Budget.xlsx',
};

const fileDoc = (items: Record<string, string>[]): JSONContent => ({
  type: 'doc',
  content: [{ type: 'microsoftFile', attrs: { items } }],
});

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
    expect(html).not.toContain('data-display');
  });

  it('keeps percent-encoded characters in the file url', () => {
    const encodedUrl =
      'https://contoso.sharepoint.com/sites/M/Shared%20Documents/C%23%20notes.docx';
    const html = jsonToHtml({
      type: 'doc',
      content: [
        {
          type: 'microsoftFile',
          attrs: {
            items: [
              {
                driveId: 'd',
                itemId: 'i',
                webUrl: encodedUrl,
                name: 'C# notes.docx',
              },
            ],
          },
        },
      ],
    });

    expect(html).toContain(`href="${encodedUrl}"`);
  });

  it('drops a file whose url is outside SharePoint', () => {
    const html = jsonToHtml({
      type: 'doc',
      content: [
        {
          type: 'microsoftFile',
          attrs: {
            items: [
              { driveId: 'd', itemId: 'i', webUrl, name: 'Plan.docx' },
              {
                driveId: 'd',
                itemId: 'j',
                webUrl: 'https://contoso.sharepoint.com@evil.example/a',
                name: 'Budget.xlsx',
              },
            ],
          },
        },
      ],
    });

    expect(html).toContain(`href="${webUrl}"`);
    expect(html).not.toContain('evil.example');
    expect(html).not.toContain('Budget.xlsx');
  });

  it('keeps every file through an html export and import', () => {
    const imported = htmlToJson(jsonToHtml(fileDoc([plan, budget])));

    expect(imported.content[0].attrs.items).toEqual([plan, budget]);
  });

  it('exports each file as its own markdown link', () => {
    expect(jsonToMarkdown(fileDoc([plan, budget]))).toBe(
      `[Plan.docx](${webUrl})\n\n[Budget.xlsx](${budgetUrl})`,
    );
  });

  it('generates search text with each file name as its own word', () => {
    const words = jsonToText(fileDoc([plan, budget])).split(/\s+/);

    expect(words).toEqual(expect.arrayContaining(['Plan.docx', 'Budget.xlsx']));
  });

  it('falls back to the file url for search text and never to an unsafe one', () => {
    const unnamed = jsonToText(fileDoc([{ ...plan, name: '' }]));
    const unsafe = jsonToText(
      fileDoc([{ ...plan, webUrl: 'javascript:alert(1)', name: '' }]),
    );

    expect(unnamed).toContain(webUrl);
    expect(unsafe).not.toContain('javascript:');
  });
});
