"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MathInline = exports.inputRegex = void 0;
const core_1 = require("@tiptap/core");
const react_1 = require("@tiptap/react");
exports.inputRegex = /(?:^|\s)((?:\$\$)((?:[^$]+))(?:\$\$))$/;
exports.MathInline = core_1.Node.create({
    name: "mathInline",
    group: "inline",
    inline: true,
    atom: true,
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
                tag: `span[data-type="${this.name}"]`,
                getAttrs: (node) => {
                    return node.hasAttribute("data-katex") ? {} : false;
                },
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "span",
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
            setMathInline: (attributes) => ({ commands }) => {
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
//# sourceMappingURL=math-inline.js.map