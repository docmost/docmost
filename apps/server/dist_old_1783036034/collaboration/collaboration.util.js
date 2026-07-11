"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tiptapExtensions = void 0;
exports.jsonToHtml = jsonToHtml;
exports.htmlToJson = htmlToJson;
exports.jsonToText = jsonToText;
exports.jsonToNode = jsonToNode;
exports.getPageId = getPageId;
exports.isEmptyParagraphDoc = isEmptyParagraphDoc;
exports.prosemirrorNodeToYElement = prosemirrorNodeToYElement;
exports.jsonToMarkdown = jsonToMarkdown;
const starter_kit_1 = require("@tiptap/starter-kit");
const extension_text_align_1 = require("@tiptap/extension-text-align");
const extension_superscript_1 = require("@tiptap/extension-superscript");
const extension_subscript_1 = require("@tiptap/extension-subscript");
const extension_typography_1 = require("@tiptap/extension-typography");
const extension_text_style_1 = require("@tiptap/extension-text-style");
const extension_color_1 = require("@tiptap/extension-color");
const extension_youtube_1 = require("@tiptap/extension-youtube");
const extension_list_1 = require("@tiptap/extension-list");
const editor_ext_1 = require("@docmost/editor-ext");
const core_1 = require("@tiptap/core");
const html_1 = require("../common/helpers/prosemirror/html");
const model_1 = require("@tiptap/pm/model");
const Y = require("yjs");
const common_1 = require("@nestjs/common");
exports.tiptapExtensions = [
    starter_kit_1.StarterKit.configure({
        codeBlock: false,
        link: false,
        trailingNode: false,
        heading: false,
    }),
    editor_ext_1.Heading,
    editor_ext_1.UniqueID.configure({
        types: ['heading', 'paragraph', 'transclusionSource'],
    }),
    editor_ext_1.Comment,
    extension_text_align_1.TextAlign.configure({ types: ['heading', 'paragraph'] }),
    editor_ext_1.Indent,
    extension_list_1.TaskList,
    extension_list_1.TaskItem.configure({
        nested: true,
    }),
    editor_ext_1.LinkExtension,
    extension_superscript_1.Superscript,
    extension_subscript_1.default,
    editor_ext_1.Highlight,
    extension_typography_1.Typography,
    editor_ext_1.TrailingNode,
    extension_text_style_1.TextStyle,
    extension_color_1.Color,
    editor_ext_1.MathInline,
    editor_ext_1.MathBlock,
    editor_ext_1.Details,
    editor_ext_1.DetailsContent,
    editor_ext_1.DetailsSummary,
    editor_ext_1.CustomTable,
    editor_ext_1.TableCell,
    editor_ext_1.TableRow,
    editor_ext_1.TableHeader,
    extension_youtube_1.Youtube,
    editor_ext_1.TiptapImage,
    editor_ext_1.TiptapVideo,
    editor_ext_1.TiptapAudio,
    editor_ext_1.TiptapPdf,
    editor_ext_1.PageBreak,
    editor_ext_1.Callout,
    editor_ext_1.Attachment,
    editor_ext_1.CustomCodeBlock,
    editor_ext_1.Drawio,
    editor_ext_1.Excalidraw,
    editor_ext_1.Embed,
    editor_ext_1.Mention,
    editor_ext_1.Subpages,
    editor_ext_1.Columns,
    editor_ext_1.Column,
    editor_ext_1.Status,
    editor_ext_1.TransclusionSource,
    editor_ext_1.TransclusionReference,
];
function jsonToHtml(tiptapJson) {
    return (0, html_1.generateHTML)(tiptapJson, exports.tiptapExtensions);
}
function htmlToJson(html) {
    const pmJson = (0, html_1.generateJSON)(html, exports.tiptapExtensions);
    try {
        return (0, editor_ext_1.addUniqueIdsToDoc)(pmJson, exports.tiptapExtensions);
    }
    catch (error) {
        console.warn('failed to add unique ids to doc', error);
        return pmJson;
    }
}
function jsonToText(tiptapJson) {
    return (0, core_1.generateText)(tiptapJson, exports.tiptapExtensions);
}
function jsonToNode(tiptapJson) {
    const schema = (0, core_1.getSchema)(exports.tiptapExtensions);
    try {
        return model_1.Node.fromJSON(schema, tiptapJson);
    }
    catch (error) {
        if (error instanceof RangeError &&
            error.message.includes('Unknown node type')) {
            common_1.Logger.warn('Stripping unknown node types from document:', error.message);
            const cleanedJson = stripUnknownNodes(tiptapJson, schema);
            return model_1.Node.fromJSON(schema, cleanedJson);
        }
        throw error;
    }
}
function getPageId(documentName) {
    return documentName.split('.')[1];
}
function isEmptyParagraphDoc(tiptapJson) {
    if (!tiptapJson || tiptapJson.type !== 'doc')
        return false;
    const content = tiptapJson.content;
    if (!Array.isArray(content) || content.length !== 1)
        return false;
    const child = content[0];
    if (!child || child.type !== 'paragraph')
        return false;
    return (!child.content ||
        (Array.isArray(child.content) && child.content.length === 0));
}
function stripUnknownNodes(json, schema) {
    if (!json || typeof json !== 'object')
        return json;
    if (json.content && Array.isArray(json.content)) {
        const newContent = [];
        for (const child of json.content) {
            const cleaned = stripUnknownNodes(child, schema);
            if (Array.isArray(cleaned)) {
                newContent.push(...cleaned);
            }
            else if (cleaned) {
                newContent.push(cleaned);
            }
        }
        json.content = newContent;
    }
    if (json.type && !schema.nodes[json.type]) {
        return (json.content && json.content.length > 0 ? json.content : null);
    }
    return json;
}
function prosemirrorNodeToYElement(node) {
    if (node.type === 'text') {
        const ytext = new Y.XmlText();
        ytext.insert(0, node.text || '');
        if (node.marks?.length > 0) {
            const attrs = {};
            for (const mark of node.marks) {
                attrs[mark.type] = mark.attrs || true;
            }
            ytext.format(0, node.text?.length || 0, attrs);
        }
        return ytext;
    }
    const element = new Y.XmlElement(node.type);
    if (node.attrs) {
        for (const [key, value] of Object.entries(node.attrs)) {
            if (value !== null && value !== undefined) {
                element.setAttribute(key, value);
            }
        }
    }
    if (node.content?.length > 0) {
        const children = node.content.map(prosemirrorNodeToYElement);
        element.insert(0, children);
    }
    return element;
}
function jsonToMarkdown(tiptapJson) {
    const html = jsonToHtml(tiptapJson);
    return (0, editor_ext_1.htmlToMarkdown)(html);
}
//# sourceMappingURL=collaboration.util.js.map