"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTableColumnWidths = normalizeTableColumnWidths;
const DEFAULT_IMPORT_COL_WIDTH_PX = 150;
function parsePixelWidth(el) {
    const attr = el.attr('width');
    if (attr) {
        const n = parseInt(attr, 10);
        if (Number.isFinite(n) && n > 0)
            return n;
    }
    const style = el.attr('style') || '';
    const m = style.match(/(?:^|;)\s*width\s*:\s*([\d.]+)\s*px/i);
    if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > 0)
            return n;
    }
    return null;
}
function deriveColumnWidths($, table) {
    const cols = table.find('> colgroup > col');
    if (cols.length > 0) {
        const widths = [];
        cols.each(function () {
            widths.push(parsePixelWidth($(this)));
        });
        if (widths.some((w) => w !== null))
            return widths;
    }
    const firstRow = table.find('> tbody > tr, > thead > tr, > tr').first();
    if (!firstRow.length)
        return null;
    const widths = [];
    firstRow.children('td, th').each(function () {
        const cell = $(this);
        const colspan = parseInt(cell.attr('colspan') || '1', 10) || 1;
        const w = parsePixelWidth(cell);
        for (let i = 0; i < colspan; i++) {
            widths.push(w !== null ? Math.round(w / colspan) : null);
        }
    });
    if (widths.every((w) => w === null))
        return null;
    return widths;
}
function normalizeTableColumnWidths($, $root) {
    $root.find('table').each(function () {
        const table = $(this);
        const firstRow = table.find('> tbody > tr, > thead > tr, > tr').first();
        if (!firstRow.length)
            return;
        let colWidths = deriveColumnWidths($, table);
        if (!colWidths) {
            let count = 0;
            firstRow.children('td, th').each(function () {
                count += parseInt($(this).attr('colspan') || '1', 10) || 1;
            });
            if (count === 0)
                return;
            colWidths = new Array(count).fill(DEFAULT_IMPORT_COL_WIDTH_PX);
        }
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
            if (slice.length === 0 || slice.every((w) => w === null))
                return;
            const values = slice.map((w) => (w == null ? 100 : w));
            cell.attr('colwidth', values.join(','));
        });
    });
}
//# sourceMappingURL=table-utils.js.map