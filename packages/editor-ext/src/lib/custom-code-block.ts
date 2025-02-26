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
