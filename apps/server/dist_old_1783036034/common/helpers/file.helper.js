"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMimeType = getMimeType;
const mime = require("mime-types");
const path = require("node:path");
function getMimeType(filePath) {
    const ext = path.extname(filePath);
    return mime.contentType(ext) || 'application/octet-stream';
}
//# sourceMappingURL=file.helper.js.map