import { Node, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathInline: {
      setMathInline: () => ReturnType;
    };
  }
}

export interface MathInlineOption {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface MathInlineAttributes {
  text: string;
}

export const inputRegex = /(?:^|\s)((?:\$\$)((?:[^$]+))(?:\$\$))$/;

export const MathInline = Node.create<MathInlineOption>({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (element) => {
          return element.innerHTML;
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
        getAttrs: (node: HTMLElement) => {
          return node.hasAttribute("data-katex") ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      { "data-type": this.name, "data-katex": true },
      `${HTMLAttributes.text}`,
    ];
  },

  addNodeView() {
    // Force the react node view to render immediately using flush sync (https://github.com/ueberdosis/tiptap/blob/b4db352f839e1d82f9add6ee7fb45561336286d8/packages/react/src/ReactRenderer.tsx#L183-L191)
    this.editor.isInitialized = true;

    return ReactNodeViewRenderer(this.options.view);
  },

  addCommands() {
    return {
      setMathInline:
        (attributes?: Record<string, any>) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => ({
          text: match[1].replaceAll("$", ""),
        }),
      }),
    ];
  },
});
