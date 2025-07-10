import { TableHeader as TiptapTableHeader } from "@tiptap/extension-table-header";

export const TableHeader = TiptapTableHeader.extend({
  name: "tableHeader",
  content: "paragraph+",
  
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {};
          }
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },
});