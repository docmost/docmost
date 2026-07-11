"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MathBlock = exports.inputRegex = void 0;
const core_1 = require("@tiptap/core");
const react_1 = require("@tiptap/react");
exports.inputRegex = /(?:^|\s)((?:\$\$\$)((?:[^$]+))(?:\$\$\$))$/;
exports.MathBlock = core_1.Node.create({
    name: "mathBlock",
    group: "block",
    atom: true,
    isolating: true,
    addOptions() {
        return {
            HTMLAttributes: {},
            view: null,
        };
    },
    addAttributes() {
        return {
            text: {
                default: "",
                parseHTML: (element) => {
                    return element.innerHTML;
                },
            },
        };
    },
    parseHTML() {
        return [
            {
                tag: `div[data-type="${this.name}"]`,
                getAttrs: (node) => {
                    return node.hasAttribute("data-katex") ? {} : false;
                },
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            { "data-type": this.name, "data-katex": true },
            `${HTMLAttributes.text}`,
        ];
    },
    addNodeView() {
        this.editor.isInitialized = true;
        return (0, react_1.ReactNodeViewRenderer)(this.options.view);
    },
    addCommands() {
        return {
            setMathBlock: (attributes) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: attributes,
                });
            },
        };
    },
    addInputRules() {
        return [
            (0, core_1.nodeInputRule)({
                find: exports.inputRegex,
                type: this.type,
                getAttributes: (match) => ({
                    text: match[1].replaceAll("$", ""),
                }),
            }),
        ];
    },
});
//# sourceMappingURL=math-block.js.map