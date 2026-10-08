import { isNodeEmpty } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Placeholder as TiptapPlaceholder } from "@tiptap/extensions";

export const Placeholder = TiptapPlaceholder.extend({
  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;
    const dataAttribute = `data-${options.dataAttribute || "placeholder"}`;

    return [
      new Plugin({
        key: new PluginKey("docmostPlaceholder"),
        props: {
          decorations: (state) => {
            if (options.showOnlyWhenEditable && !editor.isEditable) {
              return null;
            }

            const { doc, selection } = state;
            const { anchor } = selection;
            const decorations: Decoration[] = [];
            const isEmptyDoc = editor.isEmpty;

            doc.descendants((node, pos) => {
              if (!node.type.isTextblock) {
                return options.includeChildren;
              }

              const hasAnchor = anchor >= pos && anchor <= pos + node.nodeSize;
              const isEmpty = !node.isLeaf && isNodeEmpty(node);

              if ((hasAnchor || !options.showOnlyCurrent) && isEmpty) {
                const emptyNodeClass =
                  typeof options.emptyNodeClass === "function"
                    ? options.emptyNodeClass({ editor, node, pos, hasAnchor })
                    : options.emptyNodeClass;
                const classes = [emptyNodeClass];
                if (isEmptyDoc) {
                  classes.push(options.emptyEditorClass);
                }

                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: classes.join(" "),
                    [dataAttribute]:
                      typeof options.placeholder === "function"
                        ? options.placeholder({ editor, node, pos, hasAnchor })
                        : options.placeholder,
                  }),
                );
              }

              return options.includeChildren;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
