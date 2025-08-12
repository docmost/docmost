import Heading from "@tiptap/extension-heading";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { mergeAttributes } from "@tiptap/core";
import { buildAnchorDecorations } from './utils';

const HEADING_ANCHORS_PLUGIN_KEY = new PluginKey("heading-anchors");
export const HeadingAnchors = Heading.extend({
  renderHTML({ node, HTMLAttributes }) {
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel ? node.attrs.level : this.options.levels[0];

    return [
      `h${level}`,
      mergeAttributes(HTMLAttributes, {
        class: "heading-block",
      }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: HEADING_ANCHORS_PLUGIN_KEY,

        state: {
          init(_, { doc }) {
            return buildAnchorDecorations(doc);
          },

          apply(tr, oldState, _, newState) {
            if (!tr.docChanged) {
              return oldState.map(tr.mapping, tr.doc);
            }

            let headingsChanged = false;
            tr.steps.forEach((step) => {
              step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
                // Check both old and new document ranges for headings
                const checkRange = (
                  doc: ProseMirrorNode,
                  from: number,
                  to: number,
                ) => {
                  doc.nodesBetween(from, to, (node) => {
                    if (node.type.name === 'heading') {
                      headingsChanged = true;
                      return false;
                    }
                  });
                };

                if (tr.docs[0]) {
                  checkRange(tr.docs[0], oldStart, oldEnd);
                }
                checkRange(newState.doc, newStart, newEnd);
              });
            });

            if (headingsChanged) {
              return buildAnchorDecorations(newState.doc);
            }

            return oldState.map(tr.mapping, tr.doc);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export default HeadingAnchors;
