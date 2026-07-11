"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCellsInColumn = getCellsInColumn;
const tables_1 = require("@tiptap/pm/tables");
const query_1 = require("./query");
function getCellsInColumn(columnIndexes, selection) {
    const table = (0, query_1.findTable)(selection.$from);
    if (!table) {
        return;
    }
    const map = tables_1.TableMap.get(table.node);
    const indexes = Array.isArray(columnIndexes) ? columnIndexes : [columnIndexes];
    return indexes
        .filter((index) => index >= 0 && index <= map.width - 1)
        .flatMap((index) => {
        const cells = map.cellsInRect({
            left: index,
            right: index + 1,
            top: 0,
            bottom: map.height,
        });
        return cells.map((nodePos) => {
            const node = table.node.nodeAt(nodePos);
            const pos = nodePos + table.start;
            return { pos, start: pos + 1, node, depth: table.depth + 2 };
        });
    });
}
//# sourceMappingURL=get-cells-in-column.js.map