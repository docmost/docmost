import { isRelativePageLink, markInternalPageLinks } from './utils';

function docWithLinks(links: Array<{ href: string; internal?: boolean }>) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: links.map((link, i) => ({
          type: 'text',
          text: `link ${i}`,
          marks: [
            {
              type: 'link',
              attrs: { href: link.href, internal: link.internal ?? false },
            },
          ],
        })),
      },
    ],
  };
}

function linkMarks(doc: any) {
  return doc.content[0].content.map((textNode: any) => textNode.marks[0]);
}

describe('isRelativePageLink', () => {
  it.each([
    '/s/engineering/p/runbook-a1B2c3D4e5',
    '/s/engineering/p/a1B2c3D4e5',
    '/s/engineering/p/runbook-a1B2c3D4e5/',
    '/s/engineering/p/runbook-a1B2c3D4e5#deploy-steps',
  ])('accepts %s', (href) => {
    expect(isRelativePageLink(href)).toBe(true);
  });

  it.each([
    'https://docs.example.com/s/engineering/p/runbook-a1B2c3D4e5',
    '//docs.example.com/s/engineering/p/runbook-a1B2c3D4e5',
    // the client can't open these in place
    '/s/engineering/p/runbook-a1B2c3D4e5?q=deploy',
    '/s/engineering/p/runbook-a1B2c3D4e5?q=deploy#steps',
    '/p/runbook-a1B2c3D4e5',
    '/settings/account/profile',
    '/s/engineering',
    'runbook.md',
    '#deploy-steps',
    '',
    undefined,
  ])('rejects %s', (href) => {
    expect(isRelativePageLink(href)).toBe(false);
  });
});

describe('markInternalPageLinks', () => {
  it('flags relative page links and leaves other links external', () => {
    const doc = markInternalPageLinks(
      docWithLinks([
        { href: '/s/engineering/p/runbook-a1B2c3D4e5' },
        { href: '/s/engineering/p/runbook-a1B2c3D4e5#deploy-steps' },
        { href: 'https://docs.example.com/s/engineering/p/runbook-a1B2c3D4e5' },
        { href: 'https://example.com/guide' },
      ]),
    );

    expect(linkMarks(doc).map((mark) => mark.attrs.internal)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('keeps hrefs unchanged', () => {
    const href = '/s/engineering/p/runbook-a1B2c3D4e5#deploy-steps';
    const doc = markInternalPageLinks(docWithLinks([{ href }]));

    expect(linkMarks(doc)[0].attrs.href).toBe(href);
  });

  it('walks nested blocks', () => {
    const doc = markInternalPageLinks({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: docWithLinks([
                { href: '/s/engineering/p/runbook-a1B2c3D4e5' },
              ]).content,
            },
          ],
        },
      ],
    });

    const textNode = doc.content[0].content[0].content[0].content[0];
    expect(textNode.marks[0].attrs.internal).toBe(true);
  });
});
