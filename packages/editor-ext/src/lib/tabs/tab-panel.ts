import { mergeAttributes, Node } from "@tiptap/core";

export interface TabPanelOptions {
  HTMLAttributes: Record<string, unknown>;
}

export const TabPanel = Node.create<TabPanelOptions>({
  name: "tabPanel",
  content: "block+",
  defining: true,

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
        { "data-type": this.name, role: "tabpanel", class: "not-draggable-match" },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },
});
