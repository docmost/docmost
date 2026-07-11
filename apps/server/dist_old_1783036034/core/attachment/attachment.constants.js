"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inlineFileExtensions = exports.MAX_AVATAR_SIZE = exports.validImageExtensions = exports.AttachmentType = void 0;
var AttachmentType;
(function (AttachmentType) {
    AttachmentType["Avatar"] = "avatar";
    AttachmentType["WorkspaceIcon"] = "workspace-icon";
    AttachmentType["SpaceIcon"] = "space-icon";
    AttachmentType["File"] = "file";
    AttachmentType["Chat"] = "chat";
})(AttachmentType || (exports.AttachmentType = AttachmentType = {}));
exports.validImageExtensions = ['.jpg', '.png', '.jpeg'];
exports.MAX_AVATAR_SIZE = '10MB';
exports.inlineFileExtensions = [
    '.jpg',
    '.png',
    '.jpeg',
    '.pdf',
    '.mp4',
    '.mov',
    '.mp3',
    '.wav',
    '.ogg',
    '.m4a',
    '.webm',
];
//# sourceMappingURL=attachment.constants.js.map