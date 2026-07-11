"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Selection = void 0;
const core_1 = require("@tiptap/core");
const state_1 = require("@tiptap/pm/state");
const view_1 = require("@tiptap/pm/view");
exports.Selection = core_1.Extension.create({
    name: "selection",
    addProseMirrorPlugins() {
        const { editor } = this;
        return [
            new state_1.Plugin({
                key: new state_1.PluginKey("selection"),
                props: {
                    decorations(state) {
                        if (state.selection.empty) {
                            return null;
                        }
                        if (editor.isFocused === true) {
                            return null;
                        }
                        return view_1.DecorationSet.create(state.doc, [
                            view_1.Decoration.inline(state.selection.from, state.selection.to, {
                                class: "selection",
                            }),
                        ]);
                    },
                },
            }),
        ];
    },
});
exports.default = exports.Selection;
//# sourceMappingURL=selection.js.map