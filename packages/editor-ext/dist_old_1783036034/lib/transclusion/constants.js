"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSCLUSION_SOURCE_CONTENT_EXPRESSION = exports.TRANSCLUSION_SOURCE_ALLOWED_NODE_TYPES = void 0;
exports.TRANSCLUSION_SOURCE_ALLOWED_NODE_TYPES = [
    'paragraph',
    'heading',
    'blockquote',
    'codeBlock',
    'horizontalRule',
    'bulletList',
    'orderedList',
    'taskList',
    'image',
    'video',
    'audio',
    'attachment',
    'callout',
    'details',
    'embed',
    'mathBlock',
    'table',
    'drawio',
    'excalidraw',
    'pdf',
    'subpages',
    'columns',
    'youtube',
];
exports.TRANSCLUSION_SOURCE_CONTENT_EXPRESSION = `(${exports.TRANSCLUSION_SOURCE_ALLOWED_NODE_TYPES.join(' | ')})+`;
//# sourceMappingURL=constants.js.map