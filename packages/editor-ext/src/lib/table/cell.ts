import { TableCell as TiptapTableCell } from "@tiptap/extension-table";

export const TableCell = TiptapTableCell.extend({
  name: "tableCell",
  content:
    "(paragraph | heading | bulletList | orderedList | taskList | blockquote | callout | image | video | audio | subpages | attachment | mathBlock | details | codeBlock)+",

  addAttributes() {
    return {
      ...this.parent?.(),

      colwidth: {
        default: null,
        parseHTML: (element) => element.getAttribute('colwidth') || null,
        renderHTML: (attributes) => {
          if (!attributes.colwidth) return {};
          if (typeof attributes.colwidth === 'string') {
            return { colwidth: attributes.colwidth };
          }
          return { colwidth: (attributes.colwidth as number[]).join(',') };
        },
      },

      backgroundColor: {
        default: null,
        parseHTML: (element) =>
          element.style.backgroundColor ||
          element.getAttribute("data-background-color") ||
          null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {};
          }
          return {
            style: `background-color: ${attributes.backgroundColor}`,
            "data-background-color": attributes.backgroundColor,
          };
        },
      },
      backgroundColorName: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-background-color-name") || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColorName) {
            return {};
          }
          return {
            "data-background-color-name":
              attributes.backgroundColorName.toLowerCase(),
          };
        },
      },
    };
  },
});
