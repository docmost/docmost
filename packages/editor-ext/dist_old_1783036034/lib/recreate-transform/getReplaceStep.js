"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReplaceStep = getReplaceStep;
const transform_1 = require("@tiptap/pm/transform");
function getReplaceStep(fromDoc, toDoc) {
    let start = toDoc.content.findDiffStart(fromDoc.content);
    if (start === null) {
        return false;
    }
    let { a: endA, b: endB } = toDoc.content.findDiffEnd(fromDoc.content);
    const overlap = start - Math.min(endA, endB);
    if (overlap > 0) {
        if (fromDoc.resolve(start - overlap).depth <
            toDoc.resolve(endA + overlap).depth) {
            start -= overlap;
        }
        else {
            endA += overlap;
            endB += overlap;
        }
    }
    return new transform_1.ReplaceStep(start, endB, toDoc.slice(start, endA));
}
//# sourceMappingURL=getReplaceStep.js.map