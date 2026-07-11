"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSelectionRangeInRow = getSelectionRangeInRow;
const get_cells_in_column_1 = require("./get-cells-in-column");
const get_cells_in_row_1 = require("./get-cells-in-row");
function getSelectionRangeInRow(tr, startRowIndex, endRowIndex = startRowIndex) {
    let startIndex = startRowIndex;
    let endIndex = endRowIndex;
    for (let i = startRowIndex; i >= 0; i--) {
        const cells = (0, get_cells_in_row_1.getCellsInRow)(i, tr.selection);
        if (cells) {
            cells.forEach((cell) => {
                const maybeEndIndex = cell.node.attrs.rowspan + i - 1;
                if (maybeEndIndex >= startIndex) {
                    startIndex = i;
                }
                if (maybeEndIndex > endIndex) {
                    endIndex = maybeEndIndex;
                }
            });
        }
    }
    for (let i = startRowIndex; i <= endIndex; i++) {
        const cells = (0, get_cells_in_row_1.getCellsInRow)(i, tr.selection);
        if (cells) {
            cells.forEach((cell) => {
                const maybeEndIndex = cell.node.attrs.rowspan + i - 1;
                if (cell.node.attrs.rowspan > 1 && maybeEndIndex > endIndex) {
                    endIndex = maybeEndIndex;
                }
            });
        }
    }
    const indexes = [];
    for (let i = startIndex; i <= endIndex; i++) {
        const maybeCells = (0, get_cells_in_row_1.getCellsInRow)(i, tr.selection);
        if (maybeCells && maybeCells.length > 0) {
            indexes.push(i);
        }
    }
    startIndex = indexes[0];
    endIndex = indexes[indexes.length - 1];
    const firstSelectedRowCells = (0, get_cells_in_row_1.getCellsInRow)(startIndex, tr.selection);
    const firstColumnCells = (0, get_cells_in_column_1.getCellsInColumn)(0, tr.selection);
    if (!firstSelectedRowCells || !firstColumnCells) {
        return;
    }
    const $anchor = tr.doc.resolve(firstSelectedRowCells[firstSelectedRowCells.length - 1].pos);
    let headCell;
    for (let i = endIndex; i >= startIndex; i--) {
        const rowCells = (0, get_cells_in_row_1.getCellsInRow)(i, tr.selection);
        if (rowCells && rowCells.length > 0) {
            for (let j = firstColumnCells.length - 1; j >= 0; j--) {
                if (firstColumnCells[j].pos === rowCells[0].pos) {
                    headCell = rowCells[0];
                    break;
                }
            }
            if (headCell) {
                break;
            }
        }
    }
    if (!headCell) {
        return;
    }
    const $head = tr.doc.resolve(headCell.pos);
    return { $anchor, $head, indexes };
}
//# sourceMappingURL=get-selection-range-in-row.js.map