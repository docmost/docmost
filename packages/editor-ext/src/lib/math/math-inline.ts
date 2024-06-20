import { Node, nodeInputRule, wrappingInputRule } from "@tiptap/core";
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
      katex: {
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
      ["span", { "data-katex": true }, `$${HTMLAttributes.katex}$`],
    ];
  },

  renderText({ node }) {
    return node.attrs.katex;
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
          katex: match[1].replaceAll("$", ""),
        }),
      }),
    ];
  },
});
