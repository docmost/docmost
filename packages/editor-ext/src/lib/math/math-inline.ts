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
        parseHTML: (element) => element.innerHTML.split("$")[1],
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (node: HTMLElement) => {
          return node.hasAttribute("data-katex") ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {},
      ["span", { "data-katex": true }, `$${HTMLAttributes.text}$`],
    ];
  },

  renderText({ node }) {
    return node.attrs.text;
  },

  addNodeView() {
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
