import { load } from 'cheerio';
import { normalizeTableColumnWidths } from './table-utils';

function columnWidths(html: string) {
  const $ = load(html);
  normalizeTableColumnWidths($, $.root());
  return $('tr')
    .first()
    .children()
    .toArray()
    .map((cell) => $(cell).attr('colwidth'));
}

describe('imported table column widths', () => {
  it('keeps columns automatic when the source has no widths', () => {
    expect(
      columnWidths('<table><tr><th>Name</th><th>Status</th></tr></table>'),
    ).toEqual([undefined, undefined]);
  });

  it('keeps an automatic column inside a partially sized merged cell', () => {
    const table =
      '<table><colgroup><col style="width: 120px"><col><col style="width: 260px"></colgroup>' +
      '<tr><th colspan="2">Name</th><th>Status</th></tr></table>';
    expect(columnWidths(table)).toEqual(['120,0', '260']);
  });

  it('preserves deliberately sized cells, including a 150px column', () => {
    const table =
      '<table><tr><td colwidth="150">Name</td><td style="width: 80px">Status</td></tr></table>';
    expect(columnWidths(table)).toEqual(['150', '80']);
  });
});
