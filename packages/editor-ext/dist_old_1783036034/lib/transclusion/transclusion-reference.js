"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransclusionReference = void 0;
const core_1 = require("@tiptap/core");
const react_1 = require("@tiptap/react");
exports.TransclusionReference = core_1.Node.create({
    name: "transclusionReference",
    addOptions() {
        return {
            HTMLAttributes: {},
            view: null,
        };
    },
    group: "block",
    atom: true,
    selectable: true,
    draggable: false,
    addAttributes() {
        return {
            sourcePageId: {
                default: null,
                parseHTML: (el) => el.getAttribute("data-source-page-id"),
                renderHTML: (attrs) => attrs.sourcePageId
                    ? { "data-source-page-id": attrs.sourcePageId }
                    : {},
            },
            transclusionId: {
                default: null,
                parseHTML: (el) => el.getAttribute("data-transclusion-id"),
                renderHTML: (attrs) => attrs.transclusionId
                    ? { "data-transclusion-id": attrs.transclusionId }
                    : {},
            },
        };
    },
    parseHTML() {
        return [{ tag: `div[data-type="${this.name}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            (0, core_1.mergeAttributes)({ "data-type": this.name }, this.options.HTMLAttributes, HTMLAttributes),
        ];
    },
    addCommands() {
        return {
            insertTransclusionReference: (attributes) => ({ commands }) => commands.insertContent({
                type: this.name,
                attrs: attributes,
            }),
        };
    },
    addNodeView() {
        if (!this.options.view)
            return null;
        this.editor.isInitialized = true;
        return (0, react_1.ReactNodeViewRenderer)(this.options.view);
    },
});
//# sourceMappingURL=transclusion-reference.js.map