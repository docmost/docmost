"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewriteAttachmentsForUnsync = rewriteAttachmentsForUnsync;
const attachment_node_types_1 = require("../../../../common/helpers/prosemirror/attachment-node-types");
function rewriteAttachmentsForUnsync(content, generateId) {
    const cloned = content ? JSON.parse(JSON.stringify(content)) : content;
    const idMap = new Map();
    const visit = (node) => {
        if (!node || typeof node !== 'object')
            return;
        if (typeof node.type === 'string' &&
            (0, attachment_node_types_1.isAttachmentNode)(node.type) &&
            node.attrs) {
            const oldId = node.attrs.attachmentId;
            if (typeof oldId === 'string' && oldId.length > 0) {
                let newId = idMap.get(oldId);
                if (!newId) {
                    newId = generateId();
                    idMap.set(oldId, newId);
                }
                node.attrs.attachmentId = newId;
                if (typeof node.attrs.src === 'string' && node.attrs.src.includes(oldId)) {
                    node.attrs.src = node.attrs.src.split(oldId).join(newId);
                }
            }
        }
        if (Array.isArray(node.content)) {
            for (const child of node.content)
                visit(child);
        }
    };
    visit(cloned);
    const copies = Array.from(idMap.entries()).map(([oldAttachmentId, newAttachmentId]) => ({
        oldAttachmentId,
        newAttachmentId,
    }));
    return { content: cloned, copies };
}
//# sourceMappingURL=transclusion-unsync.util.js.map