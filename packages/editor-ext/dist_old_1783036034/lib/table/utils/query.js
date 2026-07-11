"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCellSelection = isCellSelection;
exports.findTable = findTable;
exports.findCellRange = findCellRange;
exports.findCellPos = findCellPos;
exports.findParentNode = findParentNode;
const tables_1 = require("@tiptap/pm/tables");
function isCellSelection(value) {
    return value instanceof tables_1.CellSelection;
}
function findTable($pos) {
    return findParentNode((node) => node.type.spec.tableRole === 'table', $pos);
}
function findCellRange(selection, anchorHit, headHit) {
    if (anchorHit == null && headHit == null && isCellSelection(selection)) {
        return [selection.$anchorCell, selection.$headCell];
    }
    const anchor = anchorHit ?? headHit ?? selection.anchor;
    const head = headHit ?? anchorHit ?? selection.head;
    const doc = selection.$head.doc;
    const $anchorCell = findCellPos(doc, anchor);
    const $headCell = findCellPos(doc, head);
    if ($anchorCell && $headCell && (0, tables_1.inSameTable)($anchorCell, $headCell)) {
        return [$anchorCell, $headCell];
    }
}
function findCellPos(doc, pos) {
    const $pos = doc.resolve(pos);
    return (0, tables_1.cellAround)($pos) || (0, tables_1.cellNear)($pos);
}
function findParentNode(predicate, $pos) {
    for (let depth = $pos.depth; depth >= 0; depth -= 1) {
        const node = $pos.node(depth);
        if (predicate(node)) {
            const pos = depth === 0 ? 0 : $pos.before(depth);
            const start = $pos.start(depth);
            return { node, pos, start, depth };
        }
    }
}
//# sourceMappingURL=query.js.map