"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSelectionRangeInColumn = getSelectionRangeInColumn;
const get_cells_in_column_1 = require("./get-cells-in-column");
const get_cells_in_row_1 = require("./get-cells-in-row");
function getSelectionRangeInColumn(tr, startColIndex, endColIndex = startColIndex) {
    let startIndex = startColIndex;
    let endIndex = endColIndex;
    for (let i = startColIndex; i >= 0; i--) {
        const cells = (0, get_cells_in_column_1.getCellsInColumn)(i, tr.selection);
        if (cells) {
            cells.forEach((cell) => {
                const maybeEndIndex = cell.node.attrs.colspan + i - 1;
                if (maybeEndIndex >= startIndex) {
                    startIndex = i;
                }
                if (maybeEndIndex > endIndex) {
                    endIndex = maybeEndIndex;
                }
            });
        }
    }
    for (let i = startColIndex; i <= endIndex; i++) {
        const cells = (0, get_cells_in_column_1.getCellsInColumn)(i, tr.selection);
        if (cells) {
            cells.forEach((cell) => {
                const maybeEndIndex = cell.node.attrs.colspan + i - 1;
                if (cell.node.attrs.colspan > 1 && maybeEndIndex > endIndex) {
                    endIndex = maybeEndIndex;
                }
            });
        }
    }
    const indexes = [];
    for (let i = startIndex; i <= endIndex; i++) {
        const maybeCells = (0, get_cells_in_column_1.getCellsInColumn)(i, tr.selection);
        if (maybeCells && maybeCells.length > 0) {
            indexes.push(i);
        }
    }
    startIndex = indexes[0];
    endIndex = indexes[indexes.length - 1];
    const firstSelectedColumnCells = (0, get_cells_in_column_1.getCellsInColumn)(startIndex, tr.selection);
    const firstRowCells = (0, get_cells_in_row_1.getCellsInRow)(0, tr.selection);
    if (!firstSelectedColumnCells || !firstRowCells) {
        return;
    }
    const $anchor = tr.doc.resolve(firstSelectedColumnCells[firstSelectedColumnCells.length - 1].pos);
    let headCell;
    for (let i = endIndex; i >= startIndex; i--) {
        const columnCells = (0, get_cells_in_column_1.getCellsInColumn)(i, tr.selection);
        if (columnCells && columnCells.length > 0) {
            for (let j = firstRowCells.length - 1; j >= 0; j--) {
                if (firstRowCells[j].pos === columnCells[0].pos) {
                    headCell = columnCells[0];
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
//# sourceMappingURL=get-selection-range-in-column.js.map