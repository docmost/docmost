"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Highlight = void 0;
const extension_highlight_1 = require("@tiptap/extension-highlight");
exports.Highlight = extension_highlight_1.Highlight.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            color: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-color") || element.style.backgroundColor,
                renderHTML: (attributes) => {
                    if (!attributes.color) {
                        return {};
                    }
                    return {
                        "data-color": attributes.color,
                        style: `background-color: ${attributes.color}; color: inherit`,
                    };
                },
            },
            colorName: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-highlight-color-name") || null,
                renderHTML: (attributes) => {
                    if (!attributes.colorName) {
                        return {};
                    }
                    return {
                        "data-highlight-color-name": attributes.colorName.toLowerCase(),
                    };
                },
            },
        };
    },
});
//# sourceMappingURL=highlight.js.map