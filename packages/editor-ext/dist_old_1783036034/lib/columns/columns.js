"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Columns = void 0;
const core_1 = require("@tiptap/core");
const model_1 = require("@tiptap/pm/model");
const state_1 = require("@tiptap/pm/state");
const view_1 = require("@tiptap/pm/view");
function columnCountFromLayout(layout) {
    if (layout.startsWith("five"))
        return 5;
    if (layout.startsWith("four"))
        return 4;
    if (layout.startsWith("three"))
        return 3;
    return 2;
}
function defaultLayoutForCount(count) {
    if (count === 3)
        return "three_equal";
    if (count === 4)
        return "four_equal";
    if (count === 5)
        return "five_equal";
    return "two_equal";
}
exports.Columns = core_1.Node.create({
    name: "columns",
    group: "block",
    content: "column+",
    defining: true,
    isolating: true,
    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },
    addAttributes() {
        return {
            layout: {
                default: "two_equal",
                parseHTML: (element) => element.getAttribute("data-layout"),
                renderHTML: (attributes) => ({
                    "data-layout": attributes.layout,
                }),
            },
            widthMode: {
                default: "normal",
                parseHTML: (element) => element.getAttribute("data-width-mode") || "normal",
                renderHTML: (attributes) => {
                    if (!attributes.widthMode || attributes.widthMode === "normal")
                        return {};
                    return { "data-width-mode": attributes.widthMode };
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
    addCommands() {
        return {
            insertColumns: (attributes) => ({ tr, state, dispatch }) => {
                const layout = attributes?.layout || "two_equal";
                const count = columnCountFromLayout(layout);
                const columnType = state.schema.nodes.column;
                const paraType = state.schema.nodes.paragraph;
                const children = Array.from({ length: count }, () => columnType.create(null, paraType.create()));
                const columnsNode = this.type.create(attributes, model_1.Fragment.from(children));
                const stepsBefore = tr.steps.length;
                tr.replaceSelectionWith(columnsNode);
                if (tr.steps.length > stepsBefore) {
                    const stepMap = tr.steps[tr.steps.length - 1].getMap();
                    let insertStart = 0;
                    stepMap.forEach((_from, _to, newFrom) => {
                        insertStart = newFrom;
                    });
                    tr.setSelection(state_1.TextSelection.near(tr.doc.resolve(insertStart + 1), 1));
                }
                if (dispatch)
                    dispatch(tr);
                return true;
            },
            setColumnsWidthMode: (widthMode) => ({ commands }) => commands.updateAttributes("columns", { widthMode }),
            setColumnCount: (count) => ({ tr, state }) => {
                const predicate = (node) => node.type.name === "columns";
                const parent = (0, core_1.findParentNode)(predicate)(state.selection);
                if (!parent)
                    return false;
                const { node: columnsNode, pos: parentPos } = parent;
                const currentCount = columnsNode.childCount;
                if (count === currentCount || count < 2 || count > 5)
                    return false;
                const columnType = state.schema.nodes.column;
                const paraType = state.schema.nodes.paragraph;
                const newChildren = [];
                if (count > currentCount) {
                    for (let i = 0; i < currentCount; i++) {
                        newChildren.push(columnsNode.child(i));
                    }
                    for (let i = currentCount; i < count; i++) {
                        newChildren.push(columnType.create(null, paraType.create()));
                    }
                }
                else {
                    for (let i = 0; i < count - 1; i++) {
                        newChildren.push(columnsNode.child(i));
                    }
                    let mergedContent = columnsNode.child(count - 1).content;
                    for (let j = count; j < currentCount; j++) {
                        const col = columnsNode.child(j);
                        const nonEmpty = [];
                        col.content.forEach((child) => {
                            if (child.type.name !== "paragraph" ||
                                child.content.size > 0) {
                                nonEmpty.push(child);
                            }
                        });
                        if (nonEmpty.length > 0) {
                            mergedContent = mergedContent.append(model_1.Fragment.from(nonEmpty));
                        }
                    }
                    newChildren.push(columnType.create(null, mergedContent));
                }
                const newLayout = defaultLayoutForCount(count);
                const newNode = columnsNode.type.create({ ...columnsNode.attrs, layout: newLayout }, model_1.Fragment.from(newChildren));
                tr.replaceWith(parentPos, parentPos + columnsNode.nodeSize, newNode);
                tr.setSelection(state_1.TextSelection.near(tr.doc.resolve(parentPos + 1), 1));
                return true;
            },
            setColumnsLayout: (layout) => ({ commands }) => commands.updateAttributes("columns", { layout }),
        };
    },
    addProseMirrorPlugins() {
        return [
            new state_1.Plugin({
                key: new state_1.PluginKey("columnsFocus"),
                props: {
                    decorations: (state) => {
                        const parent = (0, core_1.findParentNode)((node) => node.type.name === "columns")(state.selection);
                        if (!parent)
                            return view_1.DecorationSet.empty;
                        return view_1.DecorationSet.create(state.doc, [
                            view_1.Decoration.node(parent.pos, parent.pos + parent.node.nodeSize, { class: "has-focus" }),
                        ]);
                    },
                },
            }),
        ];
    },
});
//# sourceMappingURL=columns.js.map