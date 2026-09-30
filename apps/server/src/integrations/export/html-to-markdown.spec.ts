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
});
