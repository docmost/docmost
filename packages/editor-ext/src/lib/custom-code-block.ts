import CodeBlockLowlight, {
  CodeBlockLowlightOptions,
} from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface CustomCodeBlockOptions extends CodeBlockLowlightOptions {
  view: any;
}

const TAB_CHAR = "\u00A0\u00A0";

export const CustomCodeBlock = CodeBlockLowlight.extend<CustomCodeBlockOptions>(
  {
    name: 'codeBlock',
    priority: 1000, // High priority to ensure our handlers run first
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
        Enter: () => {
          if (this.editor.isActive("codeBlock")) {
            this.editor
              .chain()
              .command(({ tr }) => {
                tr.insertText("\n");
                return true;
              })
              .run();
            return true;
          }
          return false;
        },
        "Shift-Enter": () => {
          if (this.editor.isActive("codeBlock")) {
            this.editor
              .chain()
              .command(({ tr }) => {
                tr.insertText("\n");
                return true;
              })
              .run();
            return true;
          }
          return false;
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

    addProseMirrorPlugins() {
      const parentPlugins = this.parent?.() || [];
      
      return [
        new Plugin({
          key: new PluginKey("codeBlockPasteHandler"),
          props: {
            handlePaste: (view, event, slice) => {
              const { state } = view;
              const { $from } = state.selection;
              
              let inCodeBlock = false;
              for (let depth = $from.depth; depth >= 0; depth--) {
                const node = $from.node(depth);
                if (node.type.name === "codeBlock") {
                  inCodeBlock = true;
                  break;
                }
              }
              
              if (!inCodeBlock) {
                return false;
              }

              event.preventDefault();
              event.stopPropagation();

              const text = event.clipboardData?.getData("text/plain");
              if (!text) {
                return true;
              }

              const { tr } = state;
              const { from, to } = state.selection;

              tr.replaceWith(from, to, state.schema.text(text));
              view.dispatch(tr);

              return true;
            },
            
            handleDOMEvents: {
              paste: (view, event) => {
                const { state } = view;
                const { $from } = state.selection;
                
                let inCodeBlock = false;
                for (let depth = $from.depth; depth >= 0; depth--) {
                  const node = $from.node(depth);
                  if (node.type.name === "codeBlock") {
                    inCodeBlock = true;
                    break;
                  }
                }
                
                if (inCodeBlock) {
                  event.preventDefault();
                  event.stopPropagation();
                  return true;
                }
                
                return false;
              }
            }
          },
        }),
        ...parentPlugins,
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer(this.options.view);
    },
  }
);
