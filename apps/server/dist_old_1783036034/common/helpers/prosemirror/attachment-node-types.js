"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAttachmentNode = isAttachmentNode;
const ATTACHMENT_NODE_TYPES = [
    'attachment',
    'image',
    'video',
    'audio',
    'pdf',
    'excalidraw',
    'drawio',
];
function isAttachmentNode(nodeType) {
    return ATTACHMENT_NODE_TYPES.includes(nodeType);
}
//# sourceMappingURL=attachment-node-types.js.map