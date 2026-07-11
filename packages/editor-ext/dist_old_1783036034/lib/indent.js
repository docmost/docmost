"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Indent = void 0;
const core_1 = require("@tiptap/core");
const state_1 = require("@tiptap/pm/state");
const NON_INDENTABLE_ANCESTORS = new Set([
    'listItem',
    'taskItem',
    'tableCell',
    'tableHeader',
    'codeBlock',
]);
const clampIndent = (value, min, max) => {
    if (!Number.isFinite(value))
        return min;
    return Math.max(min, Math.min(max, Math.trunc(value)));
};
const hasNonIndentableAncestor = (doc, pos) => {
    const $pos = doc.resolve(pos);
    for (let depth = $pos.depth; depth >= 0; depth--) {
        if (NON_INDENTABLE_ANCESTORS.has($pos.node(depth).type.name)) {
            return true;
        }
    }
    return false;
};
exports.Indent = core_1.Extension.create({
    name: 'indent',
    priority: 1000,
    addOptions() {
        return {
            types: ['paragraph', 'heading'],
            min: 0,
            max: 8,
        };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    indent: {
                        default: this.options.min,
                        keepOnSplit: true,
                        parseHTML: (element) => {
                            const raw = element.getAttribute('data-indent');
                            if (raw === null)
                                return this.options.min;
                            return clampIndent(parseInt(raw, 10), this.options.min, this.options.max);
                        },
                        renderHTML: (attributes) => {
                            const value = attributes.indent;
                            if (value <= this.options.min)
                                return {};
                            return { 'data-indent': String(value) };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            indent: () => ({ state, tr, dispatch }) => {
                return updateIndent(state, tr, dispatch, this.options, +1);
            },
            outdent: () => ({ state, tr, dispatch }) => {
                return updateIndent(state, tr, dispatch, this.options, -1);
            },
        };
    },
    addKeyboardShortcuts() {
        const isInIndentableBlock = () => {
            const { $from } = this.editor.state.selection;
            if (!this.options.types.includes($from.parent.type.name))
                return false;
            for (let depth = $from.depth - 1; depth >= 0; depth--) {
                if (NON_INDENTABLE_ANCESTORS.has($from.node(depth).type.name)) {
                    return false;
                }
            }
            return true;
        };
        return {
            Tab: () => {
                if (!isInIndentableBlock())
                    return false;
                return this.editor.commands.indent();
            },
            'Shift-Tab': () => {
                if (!isInIndentableBlock())
                    return false;
                return this.editor.commands.outdent();
            },
            Backspace: () => {
                const { $from, empty } = this.editor.state.selection;
                if (!empty)
                    return false;
                if ($from.parentOffset !== 0)
                    return false;
                if (!isInIndentableBlock())
                    return false;
                if ($from.parent.attrs.indent <= this.options.min)
                    return false;
                this.editor.commands.outdent();
                return true;
            },
        };
    },
    addProseMirrorPlugins() {
        const types = new Set(this.options.types);
        const min = this.options.min;
        return [
            new state_1.Plugin({
                key: new state_1.PluginKey('indentNormalizer'),
                appendTransaction: (transactions, _oldState, newState) => {
                    if (!transactions.some((tr) => tr.docChanged))
                        return null;
                    const tr = newState.tr;
                    let modified = false;
                    newState.doc.descendants((node, pos) => {
                        if (!types.has(node.type.name))
                            return true;
                        if (node.attrs.indent <= min)
                            return false;
                        if (hasNonIndentableAncestor(newState.doc, pos)) {
                            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: min }, node.marks);
                            modified = true;
                        }
                        return false;
                    });
                    if (!modified)
                        return null;
                    return tr.setMeta('addToHistory', false);
                },
            }),
        ];
    },
});
function updateIndent(state, tr, dispatch, options, delta) {
    const { selection } = state;
    const { from, to } = selection;
    const types = new Set(options.types);
    let updated = false;
    state.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.type.isBlock)
            return false;
        if (NON_INDENTABLE_ANCESTORS.has(node.type.name))
            return false;
        if (!types.has(node.type.name))
            return true;
        const current = node.attrs.indent;
        const next = clampIndent(current + delta, options.min, options.max);
        if (next === current)
            return false;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
        updated = true;
        return false;
    });
    if (!updated)
        return false;
    if (dispatch)
        dispatch(tr);
    return true;
}
//# sourceMappingURL=indent.js.map