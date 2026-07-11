"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFromPath = getFromPath;
function getFromPath(obj, path) {
    const pathParts = path.split("/");
    pathParts.shift();
    while (pathParts.length) {
        const property = pathParts.shift();
        obj = obj[property];
    }
    return obj;
}
//# sourceMappingURL=getFromPath.js.map