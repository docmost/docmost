"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentDecoration = commentDecoration;
const state_1 = require("@tiptap/pm/state");
const view_1 = require("@tiptap/pm/view");
const comment_1 = require("./comment");
function commentDecoration() {
    const commentDecorationPlugin = new state_1.PluginKey('commentDecoration');
    return new state_1.Plugin({
        key: commentDecorationPlugin,
        state: {
            init() {
                return view_1.DecorationSet.empty;
            },
            apply(tr, oldSet) {
                const decorationMeta = tr.getMeta(comment_1.commentDecorationMetaKey);
                if (decorationMeta) {
                    const { from, to } = tr.selection;
                    const decoration = view_1.Decoration.inline(from, to, { class: comment_1.commentMarkClass });
                    return view_1.DecorationSet.create(tr.doc, [decoration]);
                }
                else if (decorationMeta === false) {
                    return view_1.DecorationSet.empty;
                }
                return oldSet.map(tr.mapping, tr.doc);
            },
        },
        props: {
            decorations: (state) => {
                return commentDecorationPlugin.getState(state);
            },
        },
    });
}
//# sourceMappingURL=comment-decoration.js.map