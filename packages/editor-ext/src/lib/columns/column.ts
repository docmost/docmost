import { Node, mergeAttributes } from "@tiptap/core";

export const Column = Node.create({
  name: "column",

  content: "block+",

  isolating: true,

  addAttributes() {
    return {
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-width"),
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {};
          }
          return {
            "data-width": attributes.width,
            style: `flex: 0 0 ${attributes.width}%; max-width: ${attributes.width}%;`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="column"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "column",
        placeholder: "Type / to insert",
      }),
      0,
    ];
  },
});
