import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Node as ProseMirrorNode } from "prosemirror-model";

export const BlockPosition = Extension.create({
  name: "block-position",
  addOptions: () => ({
    types: [],
  }),

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          position: {
            default: null,
            parseHTML: (element) => element.getAttribute("position"),
            renderHTML: (attributes) => ({
              position: attributes.position,
            }),
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("block-position-updater"),

        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) {
            return;
          }

          const tr = newState.tr;
          let modified = false;

          newState.doc.content.forEach(
            (node: ProseMirrorNode, offset: number, index: number) => {
              if (
                node.type.name === "paragraph" &&
                node.content.size === 0 &&
                node.attrs.position == null
              ) {
                return;
              }

              const currentPos = node.attrs?.position;
              if (currentPos !== index) {
                const pos = tr.mapping.map(offset + 1);
                tr.setNodeMarkup(pos - 1, undefined, {
                  ...node.attrs,
                  position: index,
                });
                modified = true;
              }
            },
          );

          return modified ? tr : null;
        },
      }),
    ];
  },
});
