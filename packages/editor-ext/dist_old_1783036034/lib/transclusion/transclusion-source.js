"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransclusionSource = void 0;
const core_1 = require("@tiptap/core");
const react_1 = require("@tiptap/react");
const constants_1 = require("./constants");
exports.TransclusionSource = core_1.Node.create({
    name: "transclusionSource",
    addOptions() {
        return {
            HTMLAttributes: {},
            view: null,
        };
    },
    group: "block",
    content: constants_1.TRANSCLUSION_SOURCE_CONTENT_EXPRESSION,
    defining: true,
    isolating: true,
    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: (el) => el.getAttribute("data-id"),
                renderHTML: (attrs) => attrs.id ? { "data-id": attrs.id } : {},
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
            0,
        ];
    },
    addCommands() {
        return {
            insertTransclusionSource: (attributes) => ({ commands, state, chain }) => {
                const { $from } = state.selection;
                for (let depth = $from.depth; depth > 0; depth -= 1) {
                    if ($from.node(depth).type.name === this.name)
                        return false;
                }
                const node = {
                    type: this.name,
                    attrs: attributes ?? {},
                    content: [{ type: "paragraph" }],
                };
                const parent = $from.parent;
                const isEmptyParagraph = parent.type.name === "paragraph" && parent.content.size === 0;
                if (isEmptyParagraph) {
                    return chain()
                        .insertContentAt({ from: $from.before(), to: $from.after() }, node)
                        .run();
                }
                return commands.insertContent(node);
            },
            toggleTransclusionSource: () => ({ commands }) => commands.toggleWrap(this.name),
            unsyncTransclusionSource: () => ({ state, tr, dispatch }) => {
                const { $from } = state.selection;
                let depth = $from.depth;
                while (depth > 0 && $from.node(depth).type.name !== this.name) {
                    depth -= 1;
                }
                if (depth === 0)
                    return false;
                const node = $from.node(depth);
                const start = $from.before(depth);
                const end = start + node.nodeSize;
                if (dispatch) {
                    tr.replaceWith(start, end, node.content);
                    dispatch(tr);
                }
                return true;
            },
        };
    },
    addNodeView() {
        if (!this.options.view)
            return null;
        this.editor.isInitialized = true;
        return (0, react_1.ReactNodeViewRenderer)(this.options.view);
    },
});
//# sourceMappingURL=transclusion-source.js.map