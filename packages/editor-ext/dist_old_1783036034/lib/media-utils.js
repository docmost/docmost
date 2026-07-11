"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFileUrl = normalizeFileUrl;
function normalizeFileUrl(src) {
    if (src && src.startsWith("/files/")) {
        return "/api" + src;
    }
    return src || "";
}
//# sourceMappingURL=media-utils.js.map