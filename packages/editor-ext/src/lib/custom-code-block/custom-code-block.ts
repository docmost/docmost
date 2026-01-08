import type { CodeBlockOptions } from "@tiptap/extension-code-block";
import CodeBlock from "@tiptap/extension-code-block";

import { LowlightPlugin } from "./lowlight-plugin.js";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface CodeBlockLowlightOptions extends CodeBlockOptions {
  /**
   * The lowlight instance.
   */
  lowlight: any;
  view: any;
}

const TAB_CHAR = "\u00A0\u00A0";

/**
 * This extension allows you to highlight code blocks with lowlight.
 * @see https://tiptap.dev/api/nodes/code-block-lowlight
 */
export const CustomCodeBlock = CodeBlock.extend<CodeBlockLowlightOptions>({
  selectable: true,

  addOptions() {
    return {
      ...this.parent?.(),
      lowlight: {},
      languageClassPrefix: "language-",
      exitOnTripleEnter: true,
      exitOnArrowDown: true,
      defaultLanguage: null,
      HTMLAttributes: {},
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
      "Mod-a": () => {
        if (this.editor.isActive("codeBlock")) {
          const { state } = this.editor;
          const { $from } = state.selection;

          let codeBlockNode = null;
          let codeBlockPos = null;
          let depth = 0;

          for (depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === "codeBlock") {
              codeBlockNode = node;
              codeBlockPos = $from.start(depth) - 1;
              break;
            }
          }

          if (codeBlockNode && codeBlockPos !== null) {
            const codeBlockStart = codeBlockPos;
            const codeBlockEnd = codeBlockPos + codeBlockNode.nodeSize;

            const contentStart = codeBlockStart + 1;
            const contentEnd = codeBlockEnd - 1;

            this.editor.commands.setTextSelection({
              from: contentStart,
              to: contentEnd,
            });

            return true;
          }
        }

        return false;
      },
    };
  },

  addNodeView() {
    // Force the react node view to render immediately using flush sync (https://github.com/ueberdosis/tiptap/blob/b4db352f839e1d82f9add6ee7fb45561336286d8/packages/react/src/ReactRenderer.tsx#L183-L191)
    this.editor.isInitialized = true;

    return ReactNodeViewRenderer(this.options.view);
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      LowlightPlugin({
        name: this.name,
        lowlight: this.options.lowlight,
        defaultLanguage: this.options.defaultLanguage,
      }),
    ];
  },
});
