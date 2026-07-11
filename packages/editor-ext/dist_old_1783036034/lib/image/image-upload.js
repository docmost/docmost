"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleImageUpload = void 0;
const image_dimensions_1 = require("image-dimensions");
const utils_1 = require("../utils");
const findImageNodeByPlaceholderId = (doc, placeholderId) => {
    let result = null;
    doc.descendants((node, pos) => {
        if (result)
            return false;
        if (node.type.name === 'image' &&
            node.attrs.placeholder?.id === placeholderId) {
            result = { node, pos };
            return false;
        }
        return true;
    });
    return result;
};
const handleImageUpload = ({ validateFn, onUpload }) => async (file, editor, pos, pageId) => {
    const validated = validateFn?.(file);
    if (!validated)
        return;
    const objectUrl = URL.createObjectURL(file);
    const imageDimensions = (0, image_dimensions_1.imageDimensionsFromData)(new Uint8Array(await file.arrayBuffer()));
    const placeholderId = (0, utils_1.generateNodeId)();
    const width = imageDimensions?.width ?? undefined;
    const height = imageDimensions?.height ?? undefined;
    const aspectRatio = imageDimensions
        ? imageDimensions.width / imageDimensions.height
        : undefined;
    let placeholderInserted = false;
    editor.storage.shared.imagePreviews =
        editor.storage.shared.imagePreviews || {};
    editor.storage.shared.imagePreviews[placeholderId] = objectUrl;
    const insertPlaceholder = () => {
        return ({ tr, state }) => {
            const initialPlaceholderNode = state.schema.nodes.image?.create({
                placeholder: {
                    id: placeholderId,
                    name: file.name,
                },
                width,
                height,
                aspectRatio,
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
    const replacePlaceholderWithImage = (attachment) => {
        return ({ tr }) => {
            const { pos: currentPos = null } = findImageNodeByPlaceholderId(tr.doc, placeholderId) || {};
            if (currentPos === null || !attachment)
                return false;
            tr.setNodeMarkup(currentPos, undefined, {
                src: `/api/files/${attachment.id}/${attachment.fileName}`,
                attachmentId: attachment.id,
                size: attachment.fileSize,
                width,
                height,
                aspectRatio,
            });
            return true;
        };
    };
    const removePlaceholder = () => {
        return ({ tr }) => {
            const { pos: currentPos = null } = findImageNodeByPlaceholderId(tr.doc, placeholderId) || {};
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
        if (editor.storage.shared.imagePreviews) {
            delete editor.storage.shared.imagePreviews[placeholderId];
        }
    };
    try {
        const attachment = await onUpload(file, pageId);
        clearTimeout(insertPlaceholderTimeout);
        if (placeholderInserted) {
            setTimeout(() => {
                editor.commands.command(replacePlaceholderWithImage(attachment));
                disposePreviewFile();
            }, 100);
        }
        else {
            editor
                .chain()
                .command(insertPlaceholder())
                .command(replacePlaceholderWithImage(attachment))
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
exports.handleImageUpload = handleImageUpload;
//# sourceMappingURL=image-upload.js.map