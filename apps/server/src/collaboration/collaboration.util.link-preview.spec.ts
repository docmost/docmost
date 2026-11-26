import { JSONContent } from '@tiptap/core';
import {
  htmlToJson,
  jsonToHtml,
  jsonToMarkdown,
  jsonToText,
} from './collaboration.util';

const card = {
  type: 'linkCard',
  attrs: {
    url: 'https://example.com/a',
    title: 'Example',
    description: 'Desc',
    image: 'https://example.com/og.png',
    icon: null,
  },
};

const mention = {
  type: 'linkMention',
  attrs: { url: 'https://example.com/b', title: 'Other' },
};

const docWith = (cardNode: JSONContent): JSONContent => ({
  type: 'doc',
  content: [cardNode, { type: 'paragraph', content: [mention] }],
});

describe('link preview nodes', () => {
  it("keeps a card's preview through HTML", () => {
    const json = htmlToJson(jsonToHtml(docWith(card)));
    const restored = json.content.find((n: any) => n.type === 'linkCard');

    expect(restored.attrs).toMatchObject({
      url: 'https://example.com/a',
      title: 'Example',
      description: 'Desc',
      image: 'https://example.com/og.png',
    });
  });

  it('exports cards and mentions as titled Markdown links', () => {
    const md = jsonToMarkdown(docWith(card));

    expect(md).toContain('[Example](https://example.com/a)');
    expect(md).toContain('[Other](https://example.com/b)');
  });

  it('exports the bare URL as Markdown without a title', () => {
    const md = jsonToMarkdown(
      docWith({ ...card, attrs: { ...card.attrs, title: null } }),
    );

    expect(md).toContain('https://example.com/a');
    expect(md).not.toContain('[https://example.com/a]');
  });

  it('indexes the title and the URL', () => {
    const text = jsonToText(docWith(card));

    expect(text).toContain('Example https://example.com/a');
    expect(text).toContain('Other https://example.com/b');
  });

  it('indexes the URL alone without a title', () => {
    const text = jsonToText(
      docWith({ ...card, attrs: { ...card.attrs, title: null } }),
    );

    expect(text).toContain('https://example.com/a');
    expect(text).not.toContain('null');
  });
});
