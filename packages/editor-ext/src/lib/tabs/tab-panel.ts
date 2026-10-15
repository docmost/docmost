import { mergeAttributes, Node } from "@tiptap/core";

export interface TabPanelOptions {
  HTMLAttributes: Record<string, unknown>;
}

export const TabPanel = Node.create<TabPanelOptions>({
  name: "tabPanel",
  content: "block+",

  // keep the panel when all of its content is replaced, but don't count it as
  // defining for copied content: that wraps content dragged or pasted out of a
  // tab in a new tabs block with an empty tab
  extendNodeSchema(extension) {
    return extension.name === "tabPanel" ? { definingAsContext: true } : {};
  },

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
