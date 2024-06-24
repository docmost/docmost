import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

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
