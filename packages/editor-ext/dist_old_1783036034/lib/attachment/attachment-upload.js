"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAttachmentUpload = void 0;
const utils_1 = require("../utils");
const findAttachmentNodeByPlaceholderId = (doc, placeholderId) => {
    let result = null;
    doc.descendants((node, pos) => {
        if (result)
            return false;
        if (node.type.name === "attachment" &&
            node.attrs.placeholder?.id === placeholderId) {
            result = { node, pos };
            return false;
        }
        return true;
    });
    return result;
};
const handleAttachmentUpload = ({ validateFn, onUpload }) => async (file, editor, pos, pageId, allowMedia) => {
    const validated = validateFn?.(file, allowMedia);
    if (!validated)
        return;
    const placeholderId = (0, utils_1.generateNodeId)();
    let placeholderInserted = false;
    const insertPlaceholder = () => {
        return ({ tr, state }) => {
            const initialPlaceholderNode = state.schema.nodes.attachment?.create({
                placeholder: {
                    id: placeholderId,
                },
                name: file.name,
                size: file.size,
            });
            if (!initialPlaceholderNode)
                return false;
            const { parent } = tr.doc.resolve(pos);
            const isEmptyTextBlock = parent.isTextblock && !parent.childCount;
            if (isEmptyTextBlock) {
                tr.replaceRangeWith(pos - 1, pos + 1, initialPlaceholderNode);
            }
            else {
                tr.insert(pos, initialPlaceholderNode);
            }
            return true;
        };
    };
    const replacePlaceholderWithAttachment = (attachment) => {
        return ({ tr }) => {
            const { pos: currentPos = null } = findAttachmentNodeByPlaceholderId(tr.doc, placeholderId) || {};
            if (currentPos === null || !attachment)
                return false;
            tr.setNodeMarkup(currentPos, undefined, {
                url: `/api/files/${attachment.id}/${attachment.fileName}`,
                name: attachment.fileName,
                mime: attachment.mimeType,
                size: attachment.fileSize,
                attachmentId: attachment.id,
            });
            return true;
        };
    };
    const removePlaceholder = () => {
        return ({ tr }) => {
            const { pos: currentPos = null } = findAttachmentNodeByPlaceholderId(tr.doc, placeholderId) || {};
            if (currentPos === null)
                return false;
            tr.delete(currentPos, currentPos + 2);
            return true;
        };
    };
    const insertPlaceholderTimeout = setTimeout(() => {
        editor.commands.command(insertPlaceholder());
        placeholderInserted = true;
    }, 250);
    try {
        const attachment = await onUpload(file, pageId);
        clearTimeout(insertPlaceholderTimeout);
        if (placeholderInserted) {
            setTimeout(() => {
                editor.commands.command(replacePlaceholderWithAttachment(attachment));
            }, 100);
        }
        else {
            editor
                .chain()
                .command(insertPlaceholder())
                .command(replacePlaceholderWithAttachment(attachment))
                .run();
        }
    }
    catch (error) {
        clearTimeout(insertPlaceholderTimeout);
        editor.commands.command(removePlaceholder());
    }
};
exports.handleAttachmentUpload = handleAttachmentUpload;
//# sourceMappingURL=attachment-upload.js.map