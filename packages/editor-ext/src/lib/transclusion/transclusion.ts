import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReplaceStep, ReplaceAroundStep } from "@tiptap/pm/transform";

export interface TransclusionOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface TransclusionAttributes {
  id?: string | null;
  name?: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    transclusion: {
      insertTransclusion: (attributes?: TransclusionAttributes) => ReturnType;
      setTransclusionName: (name: string | null) => ReturnType;
      toggleTransclusion: () => ReturnType;
      unsyncTransclusion: () => ReturnType;
    };
  }
}

export const Transclusion = Node.create<TransclusionOptions>({
  name: "transclusion",

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) =>
          attrs.id ? { "data-id": attrs.id } : {},
      },
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-name"),
        renderHTML: (attrs) =>
          attrs.name ? { "data-name": attrs.name } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },

  addCommands() {
    return {
      insertTransclusion:
        (attributes) =>
        ({ commands, state, chain }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            if ($from.node(depth).type.name === this.name) return false;
          }

          const node = {
            type: this.name,
            attrs: attributes ?? {},
            content: [{ type: "paragraph" }],
          };

          const parent = $from.parent;
          const isEmptyParagraph =
            parent.type.name === "paragraph" && parent.content.size === 0;

          if (isEmptyParagraph) {
            return chain()
              .insertContentAt(
                { from: $from.before(), to: $from.after() },
                node,
              )
              .run();
          }

          return commands.insertContent(node);
        },
      setTransclusionName:
        (name) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { name }),
      toggleTransclusion:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
      unsyncTransclusion:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          // Walk up to the nearest transclusion wrapper.
          let depth = $from.depth;
          while (depth > 0 && $from.node(depth).type.name !== this.name) {
            depth -= 1;
          }
          if (depth === 0) return false;

          const node = $from.node(depth);
          const start = $from.before(depth);
          const end = start + node.nodeSize;

          if (dispatch) {
            tr.replaceWith(start, end, node.content);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addNodeView() {
    if (!this.options.view) return null;
    // Force the react node view to render immediately using flush sync
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },

  addProseMirrorPlugins() {
    const typeName = this.name;
    return [
      new Plugin({
        key: new PluginKey(`${typeName}-noNesting`),
        filterTransaction: (tr, state) => {
          if (!tr.docChanged) return true;
          for (const step of tr.steps) {
            if (
              !(step instanceof ReplaceStep) &&
              !(step instanceof ReplaceAroundStep)
            ) {
              continue;
            }
            let sliceContainsTransclusion = false;
            step.slice.content.descendants((node) => {
              if (node.type.name === typeName) {
                sliceContainsTransclusion = true;
                return false;
              }
              return true;
            });
            if (!sliceContainsTransclusion) continue;

            const $insert = state.doc.resolve(step.from);
            for (let depth = $insert.depth; depth > 0; depth -= 1) {
              if ($insert.node(depth).type.name === typeName) {
                return false;
              }
            }
          }
          return true;
        },
      }),
    ];
  },
});
