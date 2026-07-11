"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Column = void 0;
const core_1 = require("@tiptap/core");
const state_1 = require("@tiptap/pm/state");
exports.Column = core_1.Node.create({
    name: "column",
    group: "block",
    content: "block+",
    defining: true,
    isolating: true,
    selectable: false,
    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },
    addAttributes() {
        return {
            width: {
                default: null,
                parseHTML: (element) => {
                    const value = element.getAttribute("data-width");
                    return value ? parseFloat(value) : null;
                },
                renderHTML: (attributes) => {
                    if (!attributes.width)
                        return {};
                    return {
                        "data-width": attributes.width,
                        style: `flex: ${attributes.width}`,
                    };
                },
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
            0,
        ];
    },
    addKeyboardShortcuts() {
        const jumpToColumn = (direction) => () => {
            const { state, dispatch } = this.editor.view;
            const columns = (0, core_1.findParentNode)((node) => node.type.name === "columns")(state.selection);
            if (!columns)
                return false;
            const column = (0, core_1.findParentNode)((node) => node.type.name === "column")(state.selection);
            if (!column)
                return false;
            let currentIndex = -1;
            columns.node.forEach((_child, offset, index) => {
                if (columns.pos + 1 + offset === column.pos) {
                    currentIndex = index;
                }
            });
            const targetIndex = currentIndex + direction;
            if (targetIndex < 0 || targetIndex >= columns.node.childCount) {
                return true;
            }
            let offset = 0;
            for (let j = 0; j < targetIndex; j++) {
                offset += columns.node.child(j).nodeSize;
            }
            const targetPos = columns.pos + 1 + offset + 1 + 1;
            if (dispatch) {
                dispatch(state.tr.setSelection(state_1.TextSelection.create(state.doc, targetPos)));
            }
            return true;
        };
        return {
            Tab: jumpToColumn(1),
            "Shift-Tab": jumpToColumn(-1),
        };
    },
    addCommands() {
        return {
            setColumnWidth: (width) => ({ commands }) => commands.updateAttributes("column", { width }),
        };
    },
});
//# sourceMappingURL=column.js.map