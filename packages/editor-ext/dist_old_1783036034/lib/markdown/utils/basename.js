"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBasename = getBasename;
function getBasename(path) {
    let end = path.length - 1;
    while (path[end] === '/' || path[end] === '\\') {
        --end;
    }
    const i1 = path.lastIndexOf('/', end);
    const i2 = path.lastIndexOf('\\', end);
    let start;
    if (i1 === -1) {
        if (i2 === -1) {
            return path;
        }
        start = i2;
    }
    else if (i2 === -1) {
        start = i1;
    }
    else {
        start = Math.max(i1, i2);
    }
    return path.substring(start + 1, end + 1);
}
//# sourceMappingURL=basename.js.map