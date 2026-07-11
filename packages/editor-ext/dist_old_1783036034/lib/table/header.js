"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableHeader = void 0;
const extension_table_1 = require("@tiptap/extension-table");
exports.TableHeader = extension_table_1.TableHeader.extend({
    name: "tableHeader",
    content: "(paragraph | heading | bulletList | orderedList | taskList | blockquote | callout | image | video | audio | subpages | attachment | mathBlock | details | codeBlock)+",
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                parseHTML: (element) => element.style.backgroundColor ||
                    element.getAttribute("data-background-color") ||
                    null,
                renderHTML: (attributes) => {
                    if (!attributes.backgroundColor) {
                        return {};
                    }
                    return {
                        style: `background-color: ${attributes.backgroundColor}`,
                        "data-background-color": attributes.backgroundColor,
                    };
                },
            },
            backgroundColorName: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-background-color-name") || null,
                renderHTML: (attributes) => {
                    if (!attributes.backgroundColorName) {
                        return {};
                    }
                    return {
                        "data-background-color-name": attributes.backgroundColorName.toLowerCase(),
                    };
                },
            },
        };
    },
});
//# sourceMappingURL=header.js.map