import {
  Highlight as TiptapHighlight,
  type HighlightOptions,
} from "@tiptap/extension-highlight";

export const Highlight = TiptapHighlight.extend<HighlightOptions>({
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-color") || element.style.backgroundColor,
        renderHTML: (attributes) => {
          if (!attributes.color) {
            return {};
          }

          return {
            "data-color": attributes.color,
            style: `background-color: ${attributes.color}; color: inherit`,
          };
        },
      },
      colorName: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-highlight-color-name") || null,
        renderHTML: (attributes) => {
          if (!attributes.colorName) {
            return {};
          }
          return {
            "data-highlight-color-name": attributes.colorName.toLowerCase(),
          };
        },
      },
    };
  },
});
