"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moveRow = moveRow;
const tables_1 = require("@tiptap/pm/tables");
const convert_array_of_rows_to_table_node_1 = require("./convert-array-of-rows-to-table-node");
const convert_table_node_to_array_of_rows_1 = require("./convert-table-node-to-array-of-rows");
const get_selection_range_in_row_1 = require("./get-selection-range-in-row");
const move_row_in_array_of_rows_1 = require("./move-row-in-array-of-rows");
const query_1 = require("./query");
function moveRow(moveRowParams) {
    const { tr, originIndex, targetIndex, select, pos } = moveRowParams;
    const $pos = tr.doc.resolve(pos);
    const table = (0, query_1.findTable)($pos);
    if (!table)
        return false;
    const indexesOriginRow = (0, get_selection_range_in_row_1.getSelectionRangeInRow)(tr, originIndex)?.indexes;
    const indexesTargetRow = (0, get_selection_range_in_row_1.getSelectionRangeInRow)(tr, targetIndex)?.indexes;
    if (!indexesOriginRow || !indexesTargetRow)
        return false;
    if (indexesOriginRow.includes(targetIndex))
        return false;
    const newTable = moveTableRow(table.node, indexesOriginRow, indexesTargetRow, 0);
    tr.replaceWith(table.pos, table.pos + table.node.nodeSize, newTable);
    if (!select)
        return true;
    const map = tables_1.TableMap.get(newTable);
    const start = table.start;
    const index = targetIndex;
    const lastCell = map.positionAt(index, map.width - 1, newTable);
    const $lastCell = tr.doc.resolve(start + lastCell);
    const firstCell = map.positionAt(index, 0, newTable);
    const $firstCell = tr.doc.resolve(start + firstCell);
    tr.setSelection(tables_1.CellSelection.rowSelection($lastCell, $firstCell));
    return true;
}
function moveTableRow(table, indexesOrigin, indexesTarget, direction) {
    let rows = (0, convert_table_node_to_array_of_rows_1.convertTableNodeToArrayOfRows)(table);
    rows = (0, move_row_in_array_of_rows_1.moveRowInArrayOfRows)(rows, indexesOrigin, indexesTarget, direction);
    return (0, convert_array_of_rows_to_table_node_1.convertArrayOfRowsToTableNode)(table, rows);
}
//# sourceMappingURL=move-row.js.map