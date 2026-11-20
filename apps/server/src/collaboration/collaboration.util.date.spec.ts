import { pageNodeToDocxBuffer } from '@docmost/editor-ext';
import * as JSZip from 'jszip';
import {
  htmlToJson,
  jsonToHtml,
  jsonToMarkdown,
  jsonToNode,
  jsonToText,
} from './collaboration.util';

const date = { type: 'date', attrs: { date: '2028-02-29', dir: 'auto' } };
const content = [
  { type: 'text', text: 'Review on ' },
  date,
  { type: 'text', text: '.' },
];
const doc = { type: 'doc', content: [{ type: 'paragraph', content }] };

describe('inline date', () => {
  it('round-trips a calendar date and its surrounding text through HTML', () => {
    const html = jsonToHtml(doc);
    expect(html).toContain('datetime="2028-02-29"');
    expect(htmlToJson(html).content[0].content).toEqual(content);
  });

  it('keeps the date readable in search text and Markdown exports', () => {
    expect(jsonToText(doc)).toBe('Review on Feb 29, 2028.');
    expect(jsonToMarkdown(doc)).toBe('Review on Feb 29, 2028.');
  });

  it('exports the date inline in a Word document', async () => {
    const buffer = await pageNodeToDocxBuffer(jsonToNode(doc), async () => new Uint8Array());
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Feb 29, 2028');
  });

  it('keeps legacy prose and malformed or unrelated time elements as text', () => {
    const html =
      '<p>Nov 23, 2026, <time data-type="date" datetime="2026-02-29">invalid day</time>, ' +
      '<time datetime="12:00">noon</time></p>';
    expect(htmlToJson(html).content[0].content).toEqual([
      { type: 'text', text: 'Nov 23, 2026, invalid day, noon' },
    ]);
  });
});
