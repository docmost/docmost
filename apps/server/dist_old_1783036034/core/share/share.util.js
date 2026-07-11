"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAttachmentAttr = updateAttachmentAttr;
function updateAttachmentAttr(node, attr, token) {
    const attrVal = node.attrs[attr];
    if (attrVal &&
        (attrVal.startsWith('/files') || attrVal.startsWith('/api/files'))) {
        node.attrs[attr] = updateAttachmentUrl(attrVal, token);
    }
}
function updateAttachmentUrl(src, jwtToken) {
    const updatedSrc = src.replace('/files/', '/files/public/');
    const separator = updatedSrc.includes('?') ? '&' : '?';
    return `${updatedSrc}${separator}jwt=${jwtToken}`;
}
//# sourceMappingURL=share.util.js.map