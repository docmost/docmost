import { Node } from "@tiptap/core";

// An inline bookmark keeps its position even between two words in one paragraph.
export const SectionAnchor = Node.create({
  name: "sectionAnchor",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-id"),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="section-anchor"][data-id]' }];
  },

  renderHTML({ node }) {
    return [
      "span",
      {
        "data-type": "section-anchor",
        "data-id": node.attrs.id,
        id: node.attrs.id,
        "aria-hidden": "true",
      },
    ];
  },
});
