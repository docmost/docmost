"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiptapAudio = void 0;
const core_1 = require("@tiptap/core");
const react_1 = require("@tiptap/react");
const media_utils_1 = require("../media-utils");
const utils_1 = require("../utils");
exports.TiptapAudio = core_1.Node.create({
    name: "audio",
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
                    src: (0, utils_1.isInternalFileUrl)(attributes.src)
                        ? (0, utils_1.sanitizeUrl)(attributes.src)
                        : "",
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
            placeholder: {
                default: null,
                rendered: false,
            },
        };
    },
    parseHTML() {
        return [
            {
                tag: "audio",
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "audio",
            (0, core_1.mergeAttributes)({ controls: "true", preload: "metadata" }, this.options.HTMLAttributes, HTMLAttributes),
            ["source", { src: HTMLAttributes.src }],
        ];
    },
    addCommands() {
        return {
            setAudio: (attrs) => ({ commands }) => {
                return commands.insertContent({
                    type: "audio",
                    attrs: attrs,
                });
            },
        };
    },
    addNodeView() {
        if (this.options.view) {
            this.editor.isInitialized = true;
            return (0, react_1.ReactNodeViewRenderer)(this.options.view);
        }
        return ({ node, HTMLAttributes }) => {
            const dom = document.createElement("div");
            const audio = document.createElement("audio");
            const src = node.attrs.src;
            if (src && (0, utils_1.isInternalFileUrl)(src)) {
                audio.src = (0, media_utils_1.normalizeFileUrl)(src);
            }
            audio.controls = true;
            audio.preload = "metadata";
            audio.style.width = "100%";
            dom.append(audio);
            return { dom };
        };
    },
});
//# sourceMappingURL=audio.js.map