import { Node, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathBlock: {
      setMathBlock: () => ReturnType;
    };
  }
}

export interface MathBlockOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface MathBlockAttributes {
  text: string;
}

export const inputRegex = /(?:^|\s)((?:\$\$\$)((?:[^$]+))(?:\$\$\$))$/;

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
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
        tag: "div",
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
      ["div", { "data-katex": true }, `$$${HTMLAttributes.text}$$`],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },

  addCommands() {
    return {
      setMathBlock:
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
