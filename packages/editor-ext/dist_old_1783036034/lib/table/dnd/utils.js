"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHoveringCell = getHoveringCell;
exports.cellInfoFromResolvedCell = cellInfoFromResolvedCell;
exports.getDndRelatedDOMs = getDndRelatedDOMs;
const tables_1 = require("@tiptap/pm/tables");
function getHoveringCell(view, event) {
    const domCell = domCellAround(event.target);
    if (!domCell)
        return;
    let pos;
    try {
        pos = view.posAtDOM(domCell, 0);
    }
    catch {
        return;
    }
    const $cellPos = (0, tables_1.cellAround)(view.state.doc.resolve(pos));
    if (!$cellPos)
        return;
    return cellInfoFromResolvedCell($cellPos);
}
function cellInfoFromResolvedCell($cellPos) {
    const map = tables_1.TableMap.get($cellPos.node(-1));
    const tableStart = $cellPos.start(-1);
    const cellRect = map.findCell($cellPos.pos - tableStart);
    const rowIndex = cellRect.top;
    const colIndex = cellRect.left;
    return {
        rowIndex,
        colIndex,
        cellPos: $cellPos.pos,
        rowFirstCellPos: getCellPos(map, tableStart, rowIndex, 0),
        colFirstCellPos: getCellPos(map, tableStart, 0, colIndex),
    };
}
function domCellAround(target) {
    while (target && target.nodeName != 'TD' && target.nodeName != 'TH') {
        target = target.classList?.contains('ProseMirror')
            ? null
            : target.parentNode;
    }
    return target;
}
function getCellPos(map, tableStart, rowIndex, colIndex) {
    const cellIndex = getCellIndex(map, rowIndex, colIndex);
    const posInTable = map.map[cellIndex];
    return tableStart + posInTable;
}
function getCellIndex(map, rowIndex, colIndex) {
    return map.width * rowIndex + colIndex;
}
function getTableDOMByPos(view, pos) {
    const dom = view.domAtPos(pos).node;
    if (!dom)
        return;
    const element = dom instanceof HTMLElement ? dom : dom.parentElement;
    const table = element?.closest('table');
    return table ?? undefined;
}
function getTargetFirstCellDOM(table, index, direction) {
    if (direction === 'row') {
        const row = table.querySelectorAll('tr')[index];
        const cell = row?.querySelector('th,td');
        return cell ?? undefined;
    }
    else {
        const row = table.querySelector('tr');
        const cell = row?.querySelectorAll('th,td')[index];
        return cell ?? undefined;
    }
}
function getDndRelatedDOMs(view, cellPos, draggingIndex, direction) {
    if (cellPos == null)
        return;
    const table = getTableDOMByPos(view, cellPos);
    if (!table)
        return;
    const cell = getTargetFirstCellDOM(table, draggingIndex, direction);
    if (!cell)
        return;
    return { table, cell };
}
//# sourceMappingURL=utils.js.map