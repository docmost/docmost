"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLabelName = normalizeLabelName;
function normalizeLabelName(name) {
    return name.trim().replace(/\s+/g, '-').toLowerCase();
}
//# sourceMappingURL=utils.js.map