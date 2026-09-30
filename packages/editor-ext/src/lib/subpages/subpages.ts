import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface SubpagesOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export type SubpagesSortBy = "default" | "title-asc" | "title-desc";

export interface SubpagesAttributes {
  sortBy?: SubpagesSortBy;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    subpages: {
      insertSubpages: (attributes?: SubpagesAttributes) => ReturnType;
      setSubpagesSortBy: (sortBy: SubpagesSortBy) => ReturnType;
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

  addAttributes() {
    return {
      sortBy: {
        default: "default",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-sort-by") || "default",
        renderHTML: (attributes: SubpagesAttributes) => ({
          "data-sort-by": attributes.sortBy || "default",
        }),
      },
    };
  },

  group: "block",
  atom: true,
  draggable: true,
  isolating: true,

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

      setSubpagesSortBy:
        (sortBy) =>
        ({ commands }) => {
          if (
            sortBy !== 'default' &&
            sortBy !== 'title-asc' &&
            sortBy !== 'title-desc'
          ) {
            return;
          }
          return commands.updateAttributes(this.name, { sortBy });
        },
    };
  },

  addNodeView() {
    // Force the react node view to render immediately using flush sync (https://github.com/ueberdosis/tiptap/blob/b4db352f839e1d82f9add6ee7fb45561336286d8/packages/react/src/ReactRenderer.tsx#L183-L191)
    this.editor.isInitialized = true;

    return ReactNodeViewRenderer(this.options.view);
  },
});
