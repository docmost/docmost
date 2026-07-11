"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attachment = void 0;
const core_1 = require("@tiptap/core");
const react_1 = require("@tiptap/react");
const utils_1 = require("../utils");
exports.Attachment = core_1.Node.create({
    name: "attachment",
    inline: false,
    group: "block",
    isolating: true,
    atom: true,
    defining: true,
    draggable: true,
    addOptions() {
        return {
            HTMLAttributes: {},
            view: null,
        };
    },
    addAttributes() {
        return {
            url: {
                default: "",
                parseHTML: (element) => {
                    const url = element.getAttribute("data-attachment-url");
                    return (0, utils_1.sanitizeUrl)(url);
                },
                renderHTML: (attributes) => ({
                    "data-attachment-url": (0, utils_1.sanitizeUrl)(attributes.url),
                }),
            },
            name: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("data-attachment-name"),
                renderHTML: (attributes) => ({
                    "data-attachment-name": attributes.name,
                }),
            },
            mime: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("data-attachment-mime"),
                renderHTML: (attributes) => ({
                    "data-attachment-mime": attributes.mime,
                }),
            },
            size: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-attachment-size"),
                renderHTML: (attributes) => ({
                    "data-attachment-size": attributes.size,
                }),
            },
            attachmentId: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("data-attachment-id"),
                renderHTML: (attributes) => ({
                    "data-attachment-id": attributes.attachmentId,
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
                "a",
                {
                    href: (0, utils_1.sanitizeUrl)(HTMLAttributes["data-attachment-url"]),
                    class: "attachment",
                    target: "blank",
                },
                `${HTMLAttributes["data-attachment-name"]}`,
            ],
        ];
    },
    addCommands() {
        return {
            setAttachment: (attrs) => ({ commands }) => {
                return commands.insertContent({
                    type: "attachment",
                    attrs: attrs,
                });
            },
        };
    },
    addNodeView() {
        this.editor.isInitialized = true;
        return (0, react_1.ReactNodeViewRenderer)(this.options.view);
    },
});
//# sourceMappingURL=attachment.js.map