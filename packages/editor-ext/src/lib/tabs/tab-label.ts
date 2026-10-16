import { mergeAttributes, Node } from "@tiptap/core";

export interface TabLabelOptions {
  HTMLAttributes: Record<string, unknown>;
}

export const TabLabel = Node.create<TabLabelOptions>({
  name: "tabLabel",
  content: "inline*",
  defining: true,
  selectable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

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
        {
          "data-type": this.name,
          "aria-hidden": "true",
          class: "not-draggable-match"
        },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },
});
