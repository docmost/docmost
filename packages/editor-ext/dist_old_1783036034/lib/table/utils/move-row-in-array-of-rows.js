"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moveRowInArrayOfRows = moveRowInArrayOfRows;
function moveRowInArrayOfRows(rows, indexesOrigin, indexesTarget, directionOverride) {
    const direction = indexesOrigin[0] > indexesTarget[0] ? -1 : 1;
    const rowsExtracted = rows.splice(indexesOrigin[0], indexesOrigin.length);
    const positionOffset = rowsExtracted.length % 2 === 0 ? 1 : 0;
    let target;
    if (directionOverride === -1 && direction === 1) {
        target = indexesTarget[0] - 1;
    }
    else if (directionOverride === 1 && direction === -1) {
        target = indexesTarget[indexesTarget.length - 1] - positionOffset + 1;
    }
    else {
        target = direction === -1
            ? indexesTarget[0]
            : indexesTarget[indexesTarget.length - 1] - positionOffset;
    }
    rows.splice(target, 0, ...rowsExtracted);
    return rows;
}
//# sourceMappingURL=move-row-in-array-of-rows.js.map