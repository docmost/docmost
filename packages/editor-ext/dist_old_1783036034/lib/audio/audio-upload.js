"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAudioUpload = void 0;
const utils_1 = require("../utils");
const findAudioNodeByPlaceholderId = (doc, placeholderId) => {
    let result = null;
    doc.descendants((node, pos) => {
        if (result)
            return false;
        if (node.type.name === "audio" &&
            node.attrs.placeholder?.id === placeholderId) {
            result = { node, pos };
            return false;
        }
        return true;
    });
    return result;
};
const handleAudioUpload = ({ validateFn, onUpload }) => async (file, editor, pos, pageId) => {
    const validated = validateFn?.(file);
    if (!validated)
        return;
    const objectUrl = URL.createObjectURL(file);
    const placeholderId = (0, utils_1.generateNodeId)();
    let placeholderInserted = false;
    editor.storage.shared.audioPreviews =
        editor.storage.shared.audioPreviews || {};
    editor.storage.shared.audioPreviews[placeholderId] = objectUrl;
    const insertPlaceholder = () => {
        return ({ tr, state }) => {
            const initialPlaceholderNode = state.schema.nodes.audio?.create({
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
    const replacePlaceholderWithAudio = (attachment) => {
        return ({ tr }) => {
            const { pos: currentPos = null } = findAudioNodeByPlaceholderId(tr.doc, placeholderId) || {};
            if (currentPos === null || !attachment)
                return;
            tr.setNodeMarkup(currentPos, undefined, {
                src: `/api/files/${attachment.id}/${attachment.fileName}`,
                attachmentId: attachment.id,
                size: attachment.fileSize,
            });
            return true;
        };
    };
    const removePlaceholder = () => {
        return ({ tr }) => {
            const { pos: currentPos = null } = findAudioNodeByPlaceholderId(tr.doc, placeholderId) || {};
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
    const disposePreviewFile = () => {
        URL.revokeObjectURL(objectUrl);
        if (editor.storage.shared.audioPreviews) {
            delete editor.storage.shared.audioPreviews[placeholderId];
        }
    };
    try {
        const attachment = await onUpload(file, pageId);
        clearTimeout(insertPlaceholderTimeout);
        if (placeholderInserted) {
            setTimeout(() => {
                editor.commands.command(replacePlaceholderWithAudio(attachment));
                disposePreviewFile();
            }, 100);
        }
        else {
            editor
                .chain()
                .command(insertPlaceholder())
                .command(replacePlaceholderWithAudio(attachment))
                .run();
            disposePreviewFile();
        }
    }
    catch (error) {
        clearTimeout(insertPlaceholderTimeout);
        editor.commands.command(removePlaceholder());
        disposePreviewFile();
    }
};
exports.handleAudioUpload = handleAudioUpload;
//# sourceMappingURL=audio-upload.js.map