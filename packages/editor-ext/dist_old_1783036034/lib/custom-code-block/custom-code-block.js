"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomCodeBlock = void 0;
const extension_code_block_1 = require("@tiptap/extension-code-block");
const state_1 = require("@tiptap/pm/state");
const gapcursor_1 = require("@tiptap/pm/gapcursor");
const lowlight_plugin_js_1 = require("./lowlight-plugin.js");
const react_1 = require("@tiptap/react");
const TAB_CHAR = '\u00A0\u00A0';
exports.CustomCodeBlock = extension_code_block_1.default.extend({
    priority: 101,
    selectable: true,
    isolating: true,
    addOptions() {
        return {
            ...this.parent?.(),
            lowlight: {},
            languageClassPrefix: 'language-',
            exitOnTripleEnter: true,
            exitOnArrowDown: true,
            defaultLanguage: null,
            HTMLAttributes: {},
            view: null,
        };
    },
    addKeyboardShortcuts() {
        const isMermaid = (node) => node?.type === this.type && node.attrs.language === 'mermaid';
        return {
            ...this.parent?.(),
            ArrowDown: ({ editor }) => {
                const { state } = editor;
                const { selection, doc } = state;
                const { $from, empty } = selection;
                if (!empty || $from.parent.type !== this.type)
                    return false;
                if ($from.parentOffset !== $from.parent.nodeSize - 2)
                    return false;
                const after = $from.after();
                if (after >= doc.content.size) {
                    return editor.commands.exitCode();
                }
                const $after = doc.resolve(after);
                const nodeAfter = $after.nodeAfter;
                if (isMermaid(nodeAfter)) {
                    return editor.commands.command(({ tr }) => {
                        tr.setSelection(state_1.TextSelection.create(tr.doc, after + 1));
                        return true;
                    });
                }
                if (nodeAfter?.type.spec.isolating &&
                    !nodeAfter.type.spec.atom) {
                    return editor.commands.command(({ tr }) => {
                        tr.setSelection(new gapcursor_1.GapCursor(tr.doc.resolve(after)));
                        return true;
                    });
                }
                return editor.commands.command(({ tr }) => {
                    tr.setSelection(state_1.Selection.near(tr.doc.resolve(after)));
                    return true;
                });
            },
            ArrowUp: ({ editor }) => {
                const { state } = editor;
                const { selection, doc } = state;
                const { $from, empty } = selection;
                if (!empty || $from.parent.type !== this.type)
                    return false;
                if ($from.parentOffset !== 0)
                    return false;
                const before = $from.before();
                if (before <= 0)
                    return false;
                const $before = doc.resolve(before);
                const nodeBefore = $before.nodeBefore;
                if (isMermaid(nodeBefore)) {
                    return editor.commands.command(({ tr }) => {
                        tr.setSelection(state_1.TextSelection.create(tr.doc, before - 1));
                        return true;
                    });
                }
                if (nodeBefore?.type.spec.isolating &&
                    !nodeBefore.type.spec.atom) {
                    return editor.commands.command(({ tr }) => {
                        tr.setSelection(new gapcursor_1.GapCursor(tr.doc.resolve(before)));
                        return true;
                    });
                }
                return false;
            },
            'Mod-a': () => {
                if (this.editor.isActive('codeBlock')) {
                    const { state } = this.editor;
                    const { $from } = state.selection;
                    let codeBlockNode = null;
                    let codeBlockPos = null;
                    let depth = 0;
                    for (depth = $from.depth; depth > 0; depth--) {
                        const node = $from.node(depth);
                        if (node.type.name === 'codeBlock') {
                            codeBlockNode = node;
                            codeBlockPos = $from.start(depth) - 1;
                            break;
                        }
                    }
                    if (codeBlockNode && codeBlockPos !== null) {
                        const codeBlockStart = codeBlockPos;
                        const codeBlockEnd = codeBlockPos + codeBlockNode.nodeSize;
                        const contentStart = codeBlockStart + 1;
                        const contentEnd = codeBlockEnd - 1;
                        this.editor.commands.setTextSelection({
                            from: contentStart,
                            to: contentEnd,
                        });
                        return true;
                    }
                }
                return false;
            },
        };
    },
    addNodeView() {
        this.editor.isInitialized = true;
        return (0, react_1.ReactNodeViewRenderer)(this.options.view);
    },
    addProseMirrorPlugins() {
        const codeBlockType = this.type;
        return [
            ...(this.parent?.() || []),
            (0, lowlight_plugin_js_1.LowlightPlugin)({
                name: this.name,
                lowlight: this.options.lowlight,
                defaultLanguage: this.options.defaultLanguage,
            }),
            new state_1.Plugin({
                props: {
                    handleKeyDown: (view, event) => {
                        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
                            return false;
                        }
                        const { state } = view;
                        const { selection } = state;
                        if (!selection.empty ||
                            !(selection instanceof state_1.TextSelection)) {
                            return false;
                        }
                        const { $from } = selection;
                        if ($from.depth === 0 || $from.parent.type === codeBlockType) {
                            return false;
                        }
                        const dir = event.key === 'ArrowUp' ? 'up' : 'down';
                        if (!view.endOfTextblock(dir))
                            return false;
                        const isMermaid = (node) => node?.type === codeBlockType && node.attrs.language === 'mermaid';
                        if (event.key === 'ArrowUp') {
                            if ($from.parentOffset !== 0)
                                return false;
                            const beforePos = $from.before();
                            const prev = state.doc.resolve(beforePos).nodeBefore;
                            if (!isMermaid(prev))
                                return false;
                            const endPos = beforePos - 1;
                            view.dispatch(state.tr.setSelection(state_1.TextSelection.create(state.doc, endPos)));
                            return true;
                        }
                        if ($from.parentOffset !== $from.parent.nodeSize - 2)
                            return false;
                        const afterPos = $from.after();
                        const next = state.doc.resolve(afterPos).nodeAfter;
                        if (!isMermaid(next))
                            return false;
                        const startPos = afterPos + 1;
                        view.dispatch(state.tr.setSelection(state_1.TextSelection.create(state.doc, startPos)));
                        return true;
                    },
                },
            }),
        ];
    },
});
//# sourceMappingURL=custom-code-block.js.map