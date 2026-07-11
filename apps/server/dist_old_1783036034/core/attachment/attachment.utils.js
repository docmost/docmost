"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validAttachmentTypes = void 0;
exports.prepareFile = prepareFile;
exports.validateFileType = validateFileType;
exports.getAttachmentFolderPath = getAttachmentFolderPath;
const path = require("path");
const attachment_constants_1 = require("./attachment.constants");
const helpers_1 = require("../../common/helpers");
const helpers_2 = require("../../common/helpers");
async function prepareFile(filePromise, options = {}) {
    const file = await filePromise;
    if (!file) {
        throw new Error('No file provided');
    }
    try {
        let buffer;
        let fileSize = 0;
        if (!options.skipBuffer) {
            buffer = await file.toBuffer();
            fileSize = buffer.length;
        }
        const sanitizedFilename = (0, helpers_1.sanitizeFileName)(file.filename);
        const fileName = sanitizedFilename.slice(0, 255);
        const fileExtension = path.extname(file.filename).toLowerCase();
        return {
            buffer,
            fileName,
            fileSize,
            fileExtension,
            mimeType: (0, helpers_2.getMimeType)(file.filename),
            multiPartFile: file,
        };
    }
    catch (error) {
        throw error;
    }
}
function validateFileType(fileExtension, allowedTypes) {
    if (!allowedTypes.includes(fileExtension)) {
        throw new Error('Invalid file type');
    }
}
function getAttachmentFolderPath(type, workspaceId) {
    switch (type) {
        case attachment_constants_1.AttachmentType.Avatar:
            return `${workspaceId}/avatars`;
        case attachment_constants_1.AttachmentType.WorkspaceIcon:
            return `${workspaceId}/workspace-logos`;
        case attachment_constants_1.AttachmentType.SpaceIcon:
            return `${workspaceId}/space-logos`;
        case attachment_constants_1.AttachmentType.File:
            return `${workspaceId}/files`;
        case attachment_constants_1.AttachmentType.Chat:
            return `${workspaceId}/chat-files`;
        default:
            return `${workspaceId}/files`;
    }
}
exports.validAttachmentTypes = Object.values(attachment_constants_1.AttachmentType);
//# sourceMappingURL=attachment.utils.js.map