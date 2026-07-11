"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleVideoUpload = void 0;
const utils_1 = require("../utils");
const findVideoNodeByPlaceholderId = (doc, placeholderId) => {
    let result = null;
    doc.descendants((node, pos) => {
        if (result)
            return false;
        if (node.type.name === "video" &&
            node.attrs.placeholder?.id === placeholderId) {
            result = { node, pos };
            return false;
        }
        return true;
    });
    return result;
};
const getVideoDimensions = (url) => {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            const width = video.videoWidth;
            const height = video.videoHeight;
            const aspectRatio = height > 0 ? width / height : 1;
            resolve({ width, height, aspectRatio });
        };
        video.onerror = () => {
            resolve(undefined);
        };
        video.src = url;
    });
};
const handleVideoUpload = ({ validateFn, onUpload }) => async (file, editor, pos, pageId) => {
    const validated = validateFn?.(file);
    if (!validated)
        return;
    const objectUrl = URL.createObjectURL(file);
    const videoDimensions = await getVideoDimensions(objectUrl);
    const placeholderId = (0, utils_1.generateNodeId)();
    const width = videoDimensions?.width ?? undefined;
    const height = videoDimensions?.height ?? undefined;
    const aspectRatio = videoDimensions?.aspectRatio;
    let placeholderInserted = false;
    editor.storage.shared.videoPreviews =
        editor.storage.shared.videoPreviews || {};
    editor.storage.shared.videoPreviews[placeholderId] = objectUrl;
    const insertPlaceholder = () => {
        return ({ tr, state }) => {
            const initialPlaceholderNode = state.schema.nodes.video?.create({
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
    const replacePlaceholderWithVideo = (attachment) => {
        return ({ tr }) => {
            const { pos: currentPos = null } = findVideoNodeByPlaceholderId(tr.doc, placeholderId) || {};
            if (currentPos === null || !attachment)
                return;
            tr.setNodeMarkup(currentPos, undefined, {
                src: `/api/files/${attachment.id}/${attachment.fileName}`,
                attachmentId: attachment.id,
                title: attachment.fileName,
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
            const { pos: currentPos = null } = findVideoNodeByPlaceholderId(tr.doc, placeholderId) || {};
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
        if (editor.storage.shared.videoPreviews) {
            delete editor.storage.shared.videoPreviews[placeholderId];
        }
    };
    try {
        const attachment = await onUpload(file, pageId);
        clearTimeout(insertPlaceholderTimeout);
        if (placeholderInserted) {
            setTimeout(() => {
                editor.commands.command(replacePlaceholderWithVideo(attachment));
                disposePreviewFile();
            }, 100);
        }
        else {
            editor
                .chain()
                .command(insertPlaceholder())
                .command(replacePlaceholderWithVideo(attachment))
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
exports.handleVideoUpload = handleVideoUpload;
//# sourceMappingURL=video-upload.js.map