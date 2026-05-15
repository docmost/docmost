import { htmlToJson, jsonToHtml } from '../../../collaboration/collaboration.util';

const findFirstChild = (
  json: any,
  type: string,
): any | undefined => {
  if (!json || typeof json !== 'object') return undefined;
  if (json.type === type) return json;
  if (Array.isArray(json.content)) {
    for (const child of json.content) {
      const found = findFirstChild(child, type);
      if (found) return found;
    }
  }
  return undefined;
};

describe('indent attribute round-trip', () => {
  it('parses data-indent on a paragraph into the indent attribute', () => {
    const html = '<p data-indent="3">Hello</p>';
    const json = htmlToJson(html);
    const paragraph = findFirstChild(json, 'paragraph');
    expect(paragraph).toBeDefined();
    expect(paragraph.attrs.indent).toBe(3);
  });

  it('parses data-indent on a heading into the indent attribute', () => {
    const html = '<h2 data-indent="2">Heading</h2>';
    const json = htmlToJson(html);
    const heading = findFirstChild(json, 'heading');
    expect(heading).toBeDefined();
    expect(heading.attrs.indent).toBe(2);
    expect(heading.attrs.level).toBe(2);
  });

  it('clamps out-of-range data-indent values', () => {
    const html = '<p data-indent="42">Too deep</p>';
    const json = htmlToJson(html);
    const paragraph = findFirstChild(json, 'paragraph');
    expect(paragraph.attrs.indent).toBe(8);
  });

  it('renders nonzero indent back to data-indent on HTML serialization', () => {
    const html = '<p data-indent="4">Round-trip</p>';
    const json = htmlToJson(html);
    const out = jsonToHtml(json);
    expect(out).toContain('data-indent="4"');
  });

  it('omits data-indent for indent zero', () => {
    const html = '<p>No indent</p>';
    const json = htmlToJson(html);
    const out = jsonToHtml(json);
    expect(out).not.toContain('data-indent');
  });

  it('preserves indent through HTML → JSON → HTML', () => {
    const original = '<p data-indent="5">Five deep</p>';
    const json = htmlToJson(original);
    const final = jsonToHtml(json);
    expect(final).toContain('data-indent="5"');
  });
});
