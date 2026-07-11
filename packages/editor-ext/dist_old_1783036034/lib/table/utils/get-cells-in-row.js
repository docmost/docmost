"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCellsInRow = getCellsInRow;
const tables_1 = require("@tiptap/pm/tables");
const query_1 = require("./query");
function getCellsInRow(rowIndex, selection) {
    const table = (0, query_1.findTable)(selection.$from);
    if (!table) {
        return;
    }
    const map = tables_1.TableMap.get(table.node);
    const indexes = Array.isArray(rowIndex) ? rowIndex : [rowIndex];
    return indexes
        .filter((index) => index >= 0 && index <= map.height - 1)
        .flatMap((index) => {
        const cells = map.cellsInRect({
            left: 0,
            right: map.width,
            top: index,
            bottom: index + 1,
        });
        return cells.map((nodePos) => {
            const node = table.node.nodeAt(nodePos);
            const pos = nodePos + table.start;
            return { pos, start: pos + 1, node, depth: table.depth + 2 };
        });
    });
}
//# sourceMappingURL=get-cells-in-row.js.map