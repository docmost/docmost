import CodeBlockLowlight, {
  CodeBlockLowlightOptions,
} from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface CustomCodeBlockOptions extends CodeBlockLowlightOptions {
  view: any;
}

const TAB_CHAR = "\u00A0\u00A0";

export const CustomCodeBlock = CodeBlockLowlight.extend<CustomCodeBlockOptions>(
  {
    selectable: true,

    addOptions() {
      return {
        ...this.parent?.(),
        view: null,
      };
    },

    addAttributes() {
      return {
        ...this.parent?.(),
        title: {
          default: null,
          parseHTML: element => element.getAttribute('data-title'),
          renderHTML: attributes => {
            if (!attributes.title) {
              return {};
            }
            return {
              'data-title': attributes.title,
            };
          },
        },
        wrapLines: {
          default: true,
          parseHTML: element => {
            const value = element.getAttribute('data-wrap-lines');
            return value === null || value === 'true';
          },
          renderHTML: attributes => {
            return {
              'data-wrap-lines': attributes.wrapLines.toString(),
            };
          },
        },
        hideHeader: {
          default: false,
          parseHTML: element => {
            const value = element.getAttribute('data-hide-header');
            return value === 'true';
          },
          renderHTML: attributes => {
            return {
              'data-hide-header': attributes.hideHeader.toString(),
            };
          },
        },
      };
    },

    addKeyboardShortcuts() {
      return {
        ...this.parent?.(),
        Tab: () => {
          if (this.editor.isActive("codeBlock")) {
            this.editor
              .chain()
              .command(({ tr }) => {
                tr.insertText(TAB_CHAR);
                return true;
              })
              .run();
            return true;
          }
        },
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(this.options.view);
    },
  }
);
