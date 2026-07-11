"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subpages = void 0;
const core_1 = require("@tiptap/core");
const react_1 = require("@tiptap/react");
exports.Subpages = core_1.Node.create({
    name: "subpages",
    addOptions() {
        return {
            HTMLAttributes: {},
            view: null,
        };
    },
    group: "block",
    atom: true,
    draggable: true,
    isolating: true,
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
        ];
    },
    addCommands() {
        return {
            insertSubpages: (attributes) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: attributes,
                });
            },
        };
    },
    addNodeView() {
        this.editor.isInitialized = true;
        return (0, react_1.ReactNodeViewRenderer)(this.options.view);
    },
});
//# sourceMappingURL=subpages.js.map