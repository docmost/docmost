import { CheerioAPI, Cheerio } from 'cheerio';

/**
 * Extracts a pixel-integer width from either the `width` attribute or
 * `style="width: Npx"` on a <col>/<td>/<th>. Returns null when absent,
 * non-numeric, or a non-px unit (em, %).
 */
function parsePixelWidth(el: Cheerio<any>): number | null {
  const attr = el.attr('width');
  if (attr) {
    const n = parseInt(attr, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const style = el.attr('style') || '';
  const m = style.match(/(?:^|;)\s*width\s*:\s*([\d.]+)\s*px/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Derives per-column widths for a table, in visual column order.
 * Priority: <colgroup><col> → first-row cells' own width style.
 * Returns an array of length = number of columns, with null entries
 * for columns whose width couldn't be determined.
 */
function deriveColumnWidths(
  $: CheerioAPI,
  table: Cheerio<any>,
): (number | null)[] | null {
  const cols = table.find('> colgroup > col');
  if (cols.length > 0) {
    const widths: (number | null)[] = [];
    cols.each(function () {
      widths.push(parsePixelWidth($(this)));
    });
    if (widths.some((w) => w !== null)) return widths;
  }

  // Fallback: first row's cells.
  const firstRow = table.find('> tbody > tr, > thead > tr, > tr').first();
  if (!firstRow.length) return null;

  const widths: (number | null)[] = [];
  firstRow.children('td, th').each(function () {
    const cell = $(this);
    const colspan = parseInt(cell.attr('colspan') || '1', 10) || 1;
    const w = parsePixelWidth(cell);
    for (let i = 0; i < colspan; i++) {
      widths.push(w !== null ? Math.round(w / colspan) : null);
    }
  });
  if (widths.every((w) => w === null)) return null;
  return widths;
}

/**
 * Apply colwidth attributes to the first row of each table based on
 * derived column widths. Accounts for colspan. Idempotent — re-running
 * on already-normalized markup is a no-op.
 *
 * This lives upstream of tiptap's generateJSON: tiptap reads
 * `colwidth="N[,N...]"` on <td>/<th> to build the runtime <colgroup>.
 */
export function normalizeTableColumnWidths(
  $: CheerioAPI,
  $root: Cheerio<any>,
): void {
  $root.find('table').each(function () {
    const table = $(this);
    const colWidths = deriveColumnWidths($, table);
    if (!colWidths) return;

    const firstRow = table.find('> tbody > tr, > thead > tr, > tr').first();
    if (!firstRow.length) return;

    let col = 0;
    firstRow.children('td, th').each(function () {
      const cell = $(this);
      if (cell.attr('colwidth')) {
        col += parseInt(cell.attr('colspan') || '1', 10) || 1;
        return;
      }
      const colspan = parseInt(cell.attr('colspan') || '1', 10) || 1;
      const slice = colWidths.slice(col, col + colspan);
      col += colspan;
      if (slice.length === 0 || slice.every((w) => w === null)) return;
      const values = slice.map((w) => (w == null ? 100 : w));
      cell.attr('colwidth', values.join(','));
    });
  });
}
