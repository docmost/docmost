"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeMarks = removeMarks;
const transform_1 = require("@tiptap/pm/transform");
function removeMarks(doc) {
    const tr = new transform_1.Transform(doc);
    tr.removeMark(0, doc.nodeSize - 2);
    return tr.doc;
}
//# sourceMappingURL=removeMarks.js.map