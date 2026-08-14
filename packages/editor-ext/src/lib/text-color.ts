import { getStyleProperty } from "@tiptap/core";
import { Color as TiptapColor } from "@tiptap/extension-color";

export const Color = TiptapColor.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: (element) => {
              const value =
                element.getAttribute("data-text-color") ??
                getStyleProperty(element, "color") ??
                element.style.color;
              return value?.replace(/['"]+/g, "") || null;
            },
            renderHTML: (attributes) => {
              if (!attributes.color) {
                return {};
              }
              // --text-color lets CSS derive a legible dark-mode variant for
              // arbitrary (imported) colors.
              return {
                "data-text-color": attributes.color,
                style: `color: ${attributes.color}; --text-color: ${attributes.color}`,
              };
            },
          },
        },
      },
    ];
  },
});
