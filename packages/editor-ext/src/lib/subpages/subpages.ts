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
  draggable: false,

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
        HTMLAttributes,
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
    return ReactNodeViewRenderer(this.options.view);
  },
});
