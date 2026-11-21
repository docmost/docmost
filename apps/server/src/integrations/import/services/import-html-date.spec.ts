import { ImportService } from './import.service';
import { formatImportHtml } from '../utils/import-formatter';

jest.mock('@sindresorhus/slugify', () => ({
  __esModule: true,
  default: (title: string) => title.toLowerCase(),
}));

describe('HTML date import', () => {
  const convert = (html: string) => ImportService.prototype.processHTML(html);

  it('preserves self-closing calendar dates, their marks, and the following content', async () => {
    const doc = await convert(
      '<p>Due <time title="a > b" datetime="2028-02-29"/> and ' +
        '<strong><span data-node-type="date" data-timestamp="0"/></strong>.</p>',
    );
    expect(doc.content[0].content).toEqual([
      { type: 'text', text: 'Due ' },
      { type: 'date', attrs: { date: '2028-02-29', dir: 'auto' } },
      { type: 'text', text: ' and ' },
      {
        type: 'date',
        attrs: { date: '1970-01-01', dir: 'auto' },
        marks: [{ type: 'bold' }],
      },
      { type: 'text', text: '.' },
    ]);
  });

  it('keeps prose, code, time-of-day and timestamp values as text', async () => {
    const doc = await convert(
      '<p>Sep 16, 2026. <code><time datetime="2028-02-29">leap day</time></code> ' +
        '<time datetime="12:00">noon</time>, <time datetime="2026-02-29">invalid</time>, ' +
        '<time datetime="2027-01-20T12:00:00Z"></time>.</p>',
    );
    expect(doc.content[0].content).toEqual([
      { type: 'text', text: 'Sep 16, 2026. ' },
      { type: 'text', text: 'leap day', marks: [{ type: 'code' }] },
      { type: 'text', text: ' noon, invalid, 2027-01-20T12:00:00Z.' },
    ]);
  });

  it('retains an editable date when the first heading would otherwise become a plain page title', async () => {
    const doc = await convert(
      '<h1>Review <time datetime="2028-02-29"></time></h1><p>Agenda</p>',
    );
    const { title, prosemirrorJson } =
      ImportService.prototype.extractTitleAndRemoveHeading(doc);
    expect(title).toBeNull();
    expect(prosemirrorJson.content[0]).toMatchObject({
      type: 'heading',
      content: [
        { type: 'text', text: 'Review ' },
        { type: 'date', attrs: { date: '2028-02-29' } },
      ],
    });
  });

  it('keeps the date and its destination when a date label matches an imported page title', async () => {
    const { html, backlinks } = await formatImportHtml({
      html: '<p><a href="calendar.html"><time datetime="2028-02-29">Calendar</time></a></p>',
      currentFilePath: 'home.html',
      filePathToPageMetaMap: new Map([
        ['calendar.html', { id: 'target', slugId: 'abc', title: 'Calendar' }],
      ]),
      creatorId: 'user',
      sourcePageId: 'home',
      workspaceId: 'workspace',
    });
    const doc = await convert(html);
    expect(doc.content[0].content).toMatchObject([
      {
        type: 'date',
        attrs: { date: '2028-02-29' },
        marks: [{ type: 'link', attrs: { href: '/p/calendar-abc' } }],
      },
    ]);
    expect(backlinks).toHaveLength(1);
  });
});
