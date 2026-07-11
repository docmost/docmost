"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Embed = void 0;
const core_1 = require("@tiptap/core");
const react_1 = require("@tiptap/react");
const utils_1 = require("./utils");
exports.Embed = core_1.Node.create({
    name: "embed",
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
            src: {
                default: "",
                parseHTML: (element) => {
                    const src = element.getAttribute("data-src");
                    return (0, utils_1.sanitizeUrl)(src);
                },
                renderHTML: (attributes) => ({
                    "data-src": (0, utils_1.sanitizeUrl)(attributes.src),
                }),
            },
            provider: {
                default: "",
                parseHTML: (element) => element.getAttribute("data-provider"),
                renderHTML: (attributes) => ({
                    "data-provider": attributes.provider,
                }),
            },
            align: {
                default: "center",
                parseHTML: (element) => element.getAttribute("data-align"),
                renderHTML: (attributes) => ({
                    "data-align": attributes.align,
                }),
            },
            width: {
                default: 800,
                parseHTML: (element) => element.getAttribute("data-width"),
                renderHTML: (attributes) => ({
                    "data-width": attributes.width,
                }),
            },
            height: {
                default: 600,
                parseHTML: (element) => element.getAttribute("data-height"),
                renderHTML: (attributes) => ({
                    "data-height": attributes.height,
                }),
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
        const src = HTMLAttributes["data-src"];
        const safeHref = (0, utils_1.sanitizeUrl)(src);
        return [
            "div",
            (0, core_1.mergeAttributes)({ "data-type": this.name }, this.options.HTMLAttributes, HTMLAttributes),
            [
                "a",
                {
                    href: safeHref,
                    target: "blank",
                },
                safeHref,
            ],
        ];
    },
    addCommands() {
        return {
            setEmbed: (attrs) => ({ commands }) => {
                const validatedAttrs = {
                    ...attrs,
                    src: (0, utils_1.sanitizeUrl)(attrs.src),
                };
                return commands.insertContent({
                    type: "embed",
                    attrs: validatedAttrs,
                });
            },
        };
    },
    addNodeView() {
        this.editor.isInitialized = true;
        return (0, react_1.ReactNodeViewRenderer)(this.options.view);
    },
});
//# sourceMappingURL=embed.js.map