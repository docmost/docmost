"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transpose = transpose;
function transpose(array) {
    return array[0].map((_, i) => {
        return array.map((column) => column[i]);
    });
}
//# sourceMappingURL=transpose.js.map