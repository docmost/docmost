"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkExtension = void 0;
const extension_link_1 = require("@tiptap/extension-link");
const state_1 = require("@tiptap/pm/state");
exports.LinkExtension = extension_link_1.default.extend({
    inclusive: false,
    addAttributes() {
        return {
            ...this.parent?.(),
            internal: {
                default: false,
                parseHTML: (element) => element.getAttribute('data-internal') === 'true',
                renderHTML: (attributes) => attributes.internal ? { 'data-internal': 'true' } : {},
            },
        };
    },
    addProseMirrorPlugins() {
        const { editor } = this;
        return [
            ...(this.parent?.() || []),
            new state_1.Plugin({
                props: {
                    handleKeyDown: (view, event) => {
                        const { selection } = editor.state;
                        if (event.key === 'Escape' && selection.empty !== true) {
                            editor.commands.focus(selection.to, { scrollIntoView: false });
                        }
                        return false;
                    },
                },
            }),
            new state_1.Plugin({
                key: new state_1.PluginKey('linkBoundaryInput'),
                props: {
                    handleKeyDown: (view, event) => {
                        if (event.key.length !== 1)
                            return false;
                        if (event.ctrlKey ||
                            event.metaKey ||
                            event.altKey ||
                            event.isComposing)
                            return false;
                        const { state } = view;
                        const linkType = state.schema.marks.link;
                        if (!linkType)
                            return false;
                        if (state.storedMarks !== null)
                            return false;
                        const { from, to } = state.selection;
                        const $from = state.doc.resolve(from);
                        const nodeBefore = $from.nodeBefore;
                        const nodeAfter = $from.nodeAfter;
                        const linkBefore = nodeBefore && linkType.isInSet(nodeBefore.marks);
                        const linkAfter = nodeAfter && linkType.isInSet(nodeAfter.marks);
                        if (linkBefore && linkAfter)
                            return false;
                        if (!linkBefore && !linkAfter)
                            return false;
                        event.preventDefault();
                        const tr = state.tr.insertText(event.key, from, to);
                        tr.removeMark(from, from + event.key.length, linkType);
                        view.dispatch(tr.scrollIntoView());
                        return true;
                    },
                },
            }),
        ];
    },
});
//# sourceMappingURL=link.js.map