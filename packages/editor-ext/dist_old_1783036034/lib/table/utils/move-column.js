"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moveColumn = moveColumn;
const tables_1 = require("@tiptap/pm/tables");
const convert_array_of_rows_to_table_node_1 = require("./convert-array-of-rows-to-table-node");
const convert_table_node_to_array_of_rows_1 = require("./convert-table-node-to-array-of-rows");
const get_selection_range_in_column_1 = require("./get-selection-range-in-column");
const move_row_in_array_of_rows_1 = require("./move-row-in-array-of-rows");
const query_1 = require("./query");
const transpose_1 = require("./transpose");
function moveColumn(moveColParams) {
    const { tr, originIndex, targetIndex, select, pos } = moveColParams;
    const $pos = tr.doc.resolve(pos);
    const table = (0, query_1.findTable)($pos);
    if (!table)
        return false;
    const indexesOriginColumn = (0, get_selection_range_in_column_1.getSelectionRangeInColumn)(tr, originIndex)?.indexes;
    const indexesTargetColumn = (0, get_selection_range_in_column_1.getSelectionRangeInColumn)(tr, targetIndex)?.indexes;
    if (!indexesOriginColumn || !indexesTargetColumn)
        return false;
    if (indexesOriginColumn.includes(targetIndex))
        return false;
    const newTable = moveTableColumn(table.node, indexesOriginColumn, indexesTargetColumn, 0);
    tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable);
    if (!select)
        return true;
    const map = tables_1.TableMap.get(newTable);
    const start = table.start;
    const index = targetIndex;
    const lastCell = map.positionAt(map.height - 1, index, newTable);
    const $lastCell = tr.doc.resolve(start + lastCell);
    const firstCell = map.positionAt(0, index, newTable);
    const $firstCell = tr.doc.resolve(start + firstCell);
    tr.setSelection(tables_1.CellSelection.colSelection($lastCell, $firstCell));
    return true;
}
function moveTableColumn(table, indexesOrigin, indexesTarget, direction) {
    let rows = (0, transpose_1.transpose)((0, convert_table_node_to_array_of_rows_1.convertTableNodeToArrayOfRows)(table));
    rows = (0, move_row_in_array_of_rows_1.moveRowInArrayOfRows)(rows, indexesOrigin, indexesTarget, direction);
    rows = (0, transpose_1.transpose)(rows);
    return (0, convert_array_of_rows_to_table_node_1.convertArrayOfRowsToTableNode)(table, rows);
}
//# sourceMappingURL=move-column.js.map