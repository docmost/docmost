"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDragOverColumn = getDragOverColumn;
exports.getDragOverRow = getDragOverRow;
function findDragOverElement(elements, pointer, axis) {
    const startProp = axis === 'x' ? 'left' : 'top';
    const endProp = axis === 'x' ? 'right' : 'bottom';
    const lastIndex = elements.length - 1;
    const index = elements.findIndex((el, index) => {
        const rect = el.getBoundingClientRect();
        const boundaryStart = rect[startProp];
        const boundaryEnd = rect[endProp];
        if (boundaryStart <= pointer && pointer <= boundaryEnd)
            return true;
        if (index === lastIndex && pointer > boundaryEnd)
            return true;
        if (index === 0 && pointer < boundaryStart)
            return true;
        return false;
    });
    return index >= 0 ? [elements[index], index] : undefined;
}
function getDragOverColumn(table, pointerX) {
    const firstRow = table.querySelector('tr');
    if (!firstRow)
        return;
    const cells = Array.from(firstRow.children);
    return findDragOverElement(cells, pointerX, 'x');
}
function getDragOverRow(table, pointerY) {
    const rows = Array.from(table.querySelectorAll('tr'));
    return findDragOverElement(rows, pointerY, 'y');
}
//# sourceMappingURL=calc-drag-over.js.map