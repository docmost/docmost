import { htmlToJson, jsonToHtml } from '../../../collaboration/collaboration.util';

describe('math node HTML parsing', () => {
  it('reads block math as LaTeX, not as escaped HTML', () => {
    const json = htmlToJson(
      '<div data-type="mathBlock" data-katex="true">a &amp; b &lt; c</div>',
    );

    expect(json.content[0]).toMatchObject({
      type: 'mathBlock',
      attrs: { text: 'a & b < c' },
    });
  });

  it('reads inline math as LaTeX, not as escaped HTML', () => {
    const json = htmlToJson(
      '<p><span data-type="mathInline" data-katex="true">a &amp; b &lt; c</span></p>',
    );

    expect(json.content[0].content[0]).toMatchObject({
      type: 'mathInline',
      attrs: { text: 'a & b < c' },
    });
  });

  it('keeps & and < through an HTML round trip', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'mathBlock', attrs: { text: 'a & b < c' } }],
    };

    const json = htmlToJson(jsonToHtml(doc));

    expect(json.content[0].attrs.text).toBe('a & b < c');
  });
});
