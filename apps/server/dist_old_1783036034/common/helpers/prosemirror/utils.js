"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAttachmentNode = void 0;
exports.extractMentions = extractMentions;
exports.extractUserMentions = extractUserMentions;
exports.extractPageMentions = extractPageMentions;
exports.extractInternalLinkSlugIds = extractInternalLinkSlugIds;
exports.extractUserMentionIdsFromJson = extractUserMentionIdsFromJson;
exports.getProsemirrorContent = getProsemirrorContent;
exports.getAttachmentIds = getAttachmentIds;
exports.removeMarkTypeFromDoc = removeMarkTypeFromDoc;
exports.createYdocFromJson = createYdocFromJson;
const collaboration_util_1 = require("../../../collaboration/collaboration.util");
const uuid_1 = require("uuid");
const transform_1 = require("@tiptap/pm/transform");
const transformer_1 = require("@hocuspocus/transformer");
const Y = require("yjs");
const utils_1 = require("../../../integrations/export/utils");
const attachment_node_types_1 = require("./attachment-node-types");
Object.defineProperty(exports, "isAttachmentNode", { enumerable: true, get: function () { return attachment_node_types_1.isAttachmentNode; } });
function extractMentions(prosemirrorJson) {
    const mentionList = [];
    const doc = (0, collaboration_util_1.jsonToNode)(prosemirrorJson);
    doc.descendants((node) => {
        if (node.type.name === 'mention') {
            if (node.attrs.id &&
                !mentionList.some((mention) => mention.id === node.attrs.id)) {
                mentionList.push({
                    id: node.attrs.id,
                    label: node.attrs.label,
                    entityType: node.attrs.entityType,
                    entityId: node.attrs.entityId,
                    creatorId: node.attrs.creatorId,
                });
            }
        }
    });
    return mentionList;
}
function extractUserMentions(mentionList) {
    const userList = [];
    for (const mention of mentionList) {
        if (mention.entityType === 'user') {
            userList.push(mention);
        }
    }
    return userList;
}
function extractPageMentions(mentionList) {
    const pageMentionList = [];
    for (const mention of mentionList) {
        if (mention.entityType === 'page' &&
            !pageMentionList.some((pageMention) => pageMention.entityId === mention.entityId)) {
            pageMentionList.push(mention);
        }
    }
    return pageMentionList;
}
function extractInternalLinkSlugIds(prosemirrorJson) {
    const slugIds = [];
    const doc = (0, collaboration_util_1.jsonToNode)(prosemirrorJson);
    doc.descendants((node) => {
        for (const mark of node.marks) {
            if (mark.type.name === 'link' && mark.attrs.internal && mark.attrs.href) {
                const match = mark.attrs.href.match(utils_1.INTERNAL_LINK_REGEX);
                if (match) {
                    const slugId = (0, utils_1.extractPageSlugId)(match[5]);
                    if (slugId && !slugIds.includes(slugId)) {
                        slugIds.push(slugId);
                    }
                }
            }
        }
    });
    return slugIds;
}
function extractUserMentionIdsFromJson(json) {
    const userIds = [];
    function walk(node) {
        if (!node)
            return;
        if (node.type === 'mention' &&
            node.attrs?.entityType === 'user' &&
            node.attrs?.entityId &&
            !userIds.includes(node.attrs.entityId)) {
            userIds.push(node.attrs.entityId);
        }
        if (Array.isArray(node.content)) {
            for (const child of node.content) {
                walk(child);
            }
        }
    }
    walk(json);
    return userIds;
}
function getProsemirrorContent(content) {
    return (content ?? {
        type: 'doc',
        content: [{ type: 'paragraph', attrs: { textAlign: 'left' } }],
    });
}
function getAttachmentIds(prosemirrorJson) {
    const doc = (0, collaboration_util_1.jsonToNode)(prosemirrorJson);
    const attachmentIds = [];
    doc?.descendants((node) => {
        if ((0, attachment_node_types_1.isAttachmentNode)(node.type.name)) {
            if (node.attrs.attachmentId && (0, uuid_1.validate)(node.attrs.attachmentId)) {
                if (!attachmentIds.includes(node.attrs.attachmentId)) {
                    attachmentIds.push(node.attrs.attachmentId);
                }
            }
        }
    });
    return attachmentIds;
}
function removeMarkTypeFromDoc(doc, markName) {
    const { schema } = doc.type;
    const markType = schema.marks[markName];
    if (!markType) {
        return doc;
    }
    const tr = new transform_1.Transform(doc).removeMark(0, doc.content.size, markType);
    return tr.doc;
}
function createYdocFromJson(prosemirrorJson) {
    if (prosemirrorJson) {
        const ydoc = transformer_1.TiptapTransformer.toYdoc(prosemirrorJson, 'default', collaboration_util_1.tiptapExtensions);
        Y.encodeStateAsUpdate(ydoc);
        return Buffer.from(Y.encodeStateAsUpdate(ydoc));
    }
    return null;
}
//# sourceMappingURL=utils.js.map