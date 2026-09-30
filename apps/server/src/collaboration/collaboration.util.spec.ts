import { jsonToMarkdown } from './collaboration.util';

const cell = (type: 'tableHeader' | 'tableCell', text: string) => ({
  type,
  content: [
    {
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    },
  ],
});

const row = (type: 'tableHeader' | 'tableCell', texts: string[]) => ({
  type: 'tableRow',
  content: texts.map((text) => cell(type, text)),
});

const tableDoc = (rows: ReturnType<typeof row>[]) => ({
  type: 'doc',
  content: [{ type: 'table', content: rows }],
});

describe('jsonToMarkdown', () => {
  it('uses the table header row as the markdown header', () => {
    const markdown = jsonToMarkdown(
      tableDoc([
        row('tableHeader', ['Name', 'Role']),
        row('tableCell', ['Ada', 'Engineer']),
      ]),
    );

    expect(markdown.trim().split('\n')).toEqual([
      '| Name | Role |',
      '| --- | --- |',
      '| Ada | Engineer |',
    ]);
  });

  it('adds an empty header when the table has no header row', () => {
    const markdown = jsonToMarkdown(
      tableDoc([
        row('tableCell', ['Ada', 'Engineer']),
        row('tableCell', ['Alan', 'Mathematician']),
      ]),
    );

    expect(markdown.trim().split('\n')).toEqual([
      '|     |     |',
      '| --- | --- |',
      '| Ada | Engineer |',
      '| Alan | Mathematician |',
    ]);
  });
});
