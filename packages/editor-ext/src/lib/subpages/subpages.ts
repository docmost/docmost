import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface SubpagesOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface SubpagesAttributes {}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    subpages: {
      insertSubpages: (attributes?: SubpagesAttributes) => ReturnType;
    };
  }
}

export const Subpages = Node.create<SubpagesOptions>({
  name: "subpages",

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  group: "block",
  atom: true,
  draggable: true,

  parseHTML() {
    return [
      {
        tag: `div[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
    ];
  },

  addCommands() {
    return {
      insertSubpages:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },

  addNodeView() {
    // Force the react node view to render immediately using flush sync (https://github.com/ueberdosis/tiptap/blob/b4db352f839e1d82f9add6ee7fb45561336286d8/packages/react/src/ReactRenderer.tsx#L183-L191)
    this.editor.isInitialized = true;

    return ReactNodeViewRenderer(this.options.view);
  },
});
