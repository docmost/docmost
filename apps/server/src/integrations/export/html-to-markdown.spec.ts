import { htmlToMarkdown } from '@docmost/editor-ext';

const colgroup =
  '<colgroup><col style="min-width: 25px;" /><col style="min-width: 25px;" /></colgroup>';

describe('htmlToMarkdown', () => {
  it('uses the table header row as the markdown header', () => {
    const markdown = htmlToMarkdown(
      `<table>${colgroup}<tbody>` +
        '<tr><th><p>Name</p></th><th><p>Role</p></th></tr>' +
        '<tr><td><p>Ada</p></td><td><p>Engineer</p></td></tr>' +
        '</tbody></table>',
    );

    expect(markdown.trim().split('\n')).toEqual([
      '| Name | Role |',
      '| --- | --- |',
      '| Ada | Engineer |',
    ]);
  });

  it('adds an empty header when the table has no header row', () => {
    const markdown = htmlToMarkdown(
      `<table>${colgroup}<tbody>` +
        '<tr><td><p>Ada</p></td><td><p>Engineer</p></td></tr>' +
        '<tr><td><p>Alan</p></td><td><p>Mathematician</p></td></tr>' +
        '</tbody></table>',
    );

    expect(markdown.trim().split('\n')).toEqual([
      '|     |     |',
      '| --- | --- |',
      '| Ada | Engineer |',
      '| Alan | Mathematician |',
    ]);
  });

  it('marks details blocks so their content is parsed as markdown', () => {
    const markdown = htmlToMarkdown(
      '<details><summary data-type="detailsSummary">Title</summary>' +
        '<div data-type="detailsContent"><p>Some <strong>bold</strong></p></div>' +
        '</details>',
    );

    expect(markdown.trim().split('\n')).toEqual([
      '<details markdown="1">',
      '<summary>Title</summary>',
      '',
      'Some **bold**',
      '',
      '</details>',
    ]);
  });

  it('exports each tab as a level 4 heading followed by its content', () => {
    const markdown = htmlToMarkdown(
      '<div data-type="tabs">' +
        '<div data-type="tab" data-tab-id="a"><div data-type="tabLabel">Windows</div>' +
        '<div data-type="tabPanel"><p>Run setup.exe</p></div></div>' +
        '<div data-type="tab" data-tab-id="b"><div data-type="tabLabel">Linux *beta*</div>' +
        '<div data-type="tabPanel"><p>Run setup.sh</p></div></div>' +
        '</div>',
    );

    expect(markdown.trim()).toBe(
      '#### Windows\n\nRun setup.exe\n\n#### Linux \\*beta\\*\n\nRun setup.sh',
    );
  });

  it('keeps nested tabs inside the panel of their parent tab', () => {
    const markdown = htmlToMarkdown(
      '<div data-type="tabs"><div data-type="tab">' +
        '<div data-type="tabLabel">Outer</div>' +
        '<div data-type="tabPanel"><p>Before</p>' +
        '<div data-type="tabs"><div data-type="tab">' +
        '<div data-type="tabLabel">Inner</div>' +
        '<div data-type="tabPanel"><p>Nested</p></div>' +
        '</div></div>' +
        '</div></div></div>',
    );

    expect(markdown.trim()).toBe('#### Outer\n\nBefore\n\n#### Inner\n\nNested');
  });

  it('stays fast on large tables', () => {
    const rows = Array.from(
      { length: 500 },
      (_, row) =>
        `<tr>${Array.from({ length: 8 }, () => `<td><p>${row}</p></td>`).join('')}</tr>`,
    ).join('');

    const start = performance.now();
    const markdown = htmlToMarkdown(`<table><tbody>${rows}</tbody></table>`);
    const elapsed = performance.now() - start;

    expect(markdown.trim().split('\n')).toHaveLength(502);
    expect(elapsed).toBeLessThan(2000);
  });
});
