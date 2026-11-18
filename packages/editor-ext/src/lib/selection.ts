import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Decorating wraps every text node of the selection, on each blur and focus.
const MAX_HIGHLIGHTED_SELECTION_SIZE = 20000;

export const Selection = Extension.create({
  name: "selection",

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      new Plugin({
        key: new PluginKey("selection"),
        props: {
          decorations(state) {
            if (state.selection.empty) {
              return null;
            }

            if (editor.isFocused === true) {
              return null;
            }

            const { from, to } = state.selection;
            if (to - from > MAX_HIGHLIGHTED_SELECTION_SIZE) {
              return null;
            }

            return DecorationSet.create(state.doc, [
              Decoration.inline(state.selection.from, state.selection.to, {
                class: "selection",
              }),
            ]);
          },
        },
      }),
    ];
  },
});

export default Selection;
