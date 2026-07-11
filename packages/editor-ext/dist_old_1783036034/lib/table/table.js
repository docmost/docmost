"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomTable = void 0;
const extension_table_1 = require("@tiptap/extension-table");
const state_1 = require("@tiptap/pm/state");
const tables_1 = require("@tiptap/pm/tables");
const LIST_TYPES = ["bulletList", "orderedList", "taskList"];
function isInList(editor) {
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (LIST_TYPES.includes(node.type.name)) {
            return true;
        }
    }
    return false;
}
function handleListIndent(editor) {
    return (editor.commands.sinkListItem("listItem") ||
        editor.commands.sinkListItem("taskItem"));
}
function handleListOutdent(editor) {
    return (editor.commands.liftListItem("listItem") ||
        editor.commands.liftListItem("taskItem"));
}
exports.CustomTable = extension_table_1.Table.extend({
    addKeyboardShortcuts() {
        return {
            ...this.parent?.(),
            "Mod-a": () => {
                const { state, view } = this.editor;
                const { selection, doc } = state;
                const $cellPos = (0, tables_1.cellAround)(selection.$anchor);
                if (!$cellPos)
                    return false;
                const cellNode = doc.nodeAt($cellPos.pos);
                if (!cellNode || !cellNode.textContent)
                    return false;
                const from = $cellPos.pos + 1;
                const to = $cellPos.pos + cellNode.nodeSize - 1;
                if (from >= to)
                    return true;
                const nextSel = state_1.TextSelection.between(doc.resolve(from), doc.resolve(to), 1);
                if (!nextSel || selection.eq(nextSel))
                    return true;
                view.dispatch(state.tr.setSelection(nextSel));
                return true;
            },
            Tab: () => {
                if (isInList(this.editor) && this.editor.isActive("table")) {
                    if (handleListIndent(this.editor)) {
                        return true;
                    }
                }
                if (this.editor.commands.goToNextCell()) {
                    return true;
                }
                if (!this.editor.can().addRowAfter()) {
                    return false;
                }
                return this.editor.chain().addRowAfter().goToNextCell().run();
            },
            "Shift-Tab": () => {
                if (isInList(this.editor) && this.editor.isActive("table")) {
                    if (handleListOutdent(this.editor)) {
                        return true;
                    }
                }
                return this.editor.commands.goToPreviousCell();
            },
        };
    },
    renderHTML({ node, HTMLAttributes }) {
        const originalRender = this.parent?.({ node, HTMLAttributes });
        const wrapper = [
            "div",
            { class: "tableWrapper" },
            originalRender,
        ];
        return wrapper;
    },
});
//# sourceMappingURL=table.js.map