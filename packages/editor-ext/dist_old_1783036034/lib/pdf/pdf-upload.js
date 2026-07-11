"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePdfUpload = void 0;
const utils_1 = require("../utils");
const findPdfNodeByPlaceholderId = (doc, placeholderId) => {
    let result = null;
    doc.descendants((node, pos) => {
        if (result)
            return false;
        if (node.type.name === "pdf" &&
            node.attrs.placeholder?.id === placeholderId) {
            result = { node, pos };
            return false;
        }
        return true;
    });
    return result;
};
const handlePdfUpload = ({ validateFn, onUpload }) => async (file, editor, pos, pageId) => {
    const validated = validateFn?.(file);
    if (!validated)
        return;
    const placeholderId = (0, utils_1.generateNodeId)();
    let placeholderInserted = false;
    const insertPlaceholder = () => {
        return ({ tr, state }) => {
            const initialPlaceholderNode = state.schema.nodes.pdf?.create({
                placeholder: {
                    id: placeholderId,
                    name: file.name,
                },
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
    const replacePlaceholderWithPdf = (attachment) => {
        return ({ tr }) => {
            const { pos: currentPos = null } = findPdfNodeByPlaceholderId(tr.doc, placeholderId) || {};
            if (currentPos === null || !attachment)
                return;
            tr.setNodeMarkup(currentPos, undefined, {
                src: `/api/files/${attachment.id}/${attachment.fileName}`,
                name: attachment.fileName,
                attachmentId: attachment.id,
                size: attachment.fileSize,
            });
            return true;
        };
    };
    const removePlaceholder = () => {
        return ({ tr }) => {
            const { pos: currentPos = null } = findPdfNodeByPlaceholderId(tr.doc, placeholderId) || {};
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
                editor.commands.command(replacePlaceholderWithPdf(attachment));
            }, 100);
        }
        else {
            editor
                .chain()
                .command(insertPlaceholder())
                .command(replacePlaceholderWithPdf(attachment))
                .run();
        }
    }
    catch (error) {
        clearTimeout(insertPlaceholderTimeout);
        editor.commands.command(removePlaceholder());
    }
};
exports.handlePdfUpload = handlePdfUpload;
//# sourceMappingURL=pdf-upload.js.map