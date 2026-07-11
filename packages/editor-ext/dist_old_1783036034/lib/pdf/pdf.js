"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiptapPdf = void 0;
const react_1 = require("@tiptap/react");
const core_1 = require("@tiptap/core");
const utils_1 = require("../utils");
exports.TiptapPdf = core_1.Node.create({
    name: "pdf",
    group: "block",
    isolating: true,
    atom: true,
    defining: true,
    draggable: true,
    addOptions() {
        return {
            view: null,
            HTMLAttributes: {},
        };
    },
    addAttributes() {
        return {
            src: {
                default: "",
                parseHTML: (element) => {
                    const src = element.getAttribute("src");
                    const sanitized = (0, utils_1.sanitizeUrl)(src);
                    return (0, utils_1.isInternalFileUrl)(sanitized) ? sanitized : "";
                },
                renderHTML: (attributes) => ({
                    src: (0, utils_1.isInternalFileUrl)(attributes.src) ? (0, utils_1.sanitizeUrl)(attributes.src) : "",
                }),
            },
            name: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("data-name"),
                renderHTML: (attributes) => ({
                    "data-name": attributes.name,
                }),
            },
            attachmentId: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("data-attachment-id"),
                renderHTML: (attributes) => ({
                    "data-attachment-id": attributes.attachmentId,
                }),
            },
            size: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-size"),
                renderHTML: (attributes) => ({
                    "data-size": attributes.size,
                }),
            },
            width: {
                default: 800,
                parseHTML: (element) => {
                    const raw = element.getAttribute("width");
                    if (!raw)
                        return null;
                    const num = parseFloat(raw);
                    return isNaN(num) ? null : num;
                },
                renderHTML: (attributes) => ({
                    width: attributes.width,
                }),
            },
            height: {
                default: 600,
                parseHTML: (element) => {
                    const raw = element.getAttribute("height");
                    if (!raw)
                        return null;
                    const num = parseFloat(raw);
                    return isNaN(num) ? null : num;
                },
                renderHTML: (attributes) => ({
                    height: attributes.height,
                }),
            },
            placeholder: {
                default: null,
                rendered: false,
            },
        };
    },
    parseHTML() {
        return [
            {
                tag: `div[data-type="${this.name}"]`,
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            (0, core_1.mergeAttributes)({ "data-type": this.name }, this.options.HTMLAttributes, HTMLAttributes),
            [
                "iframe",
                {
                    src: (0, utils_1.isInternalFileUrl)(HTMLAttributes.src) ? (0, utils_1.sanitizeUrl)(HTMLAttributes.src) : "",
                    width: HTMLAttributes.width || 800,
                    height: HTMLAttributes.height || 600,
                },
            ],
        ];
    },
    addCommands() {
        return {
            setPdf: (attrs) => ({ commands }) => {
                return commands.insertContent({
                    type: "pdf",
                    attrs,
                });
            },
        };
    },
    addNodeView() {
        this.editor.isInitialized = true;
        return (0, react_1.ReactNodeViewRenderer)(this.options.view);
    },
});
//# sourceMappingURL=pdf.js.map