import { Node, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    typstBlock: {
      setTypstBlock: () => ReturnType;
    };
  }
}

export interface TypstBlockOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface TypstBlockAttributes {
  text: string;
  editMode?: string;
  scale?: number;
}

export const typstInputRegex = /(?:^|\s)(```typst(?:[ \t]*\n)?([\s\S]+?)```)[\t ]*$/;

export const TypstBlock = Node.create({
  name: "typstBlock",
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
        parseHTML: (element) => {
          return element.textContent ?? "";
        },
      },
      editMode: {
        default: "display",
        parseHTML: (element) => {
          return element.getAttribute("data-edit-mode") ?? "display";
        },
        renderHTML: (attributes) => {
          return {
            "data-edit-mode": attributes.editMode,
          };
        },
      },
      scale: {
        default: 100,
        parseHTML: (element) => {
          const scaleAttr = element.getAttribute("data-scale");
          return scaleAttr ? parseInt(scaleAttr, 10) : 100;
        },
        renderHTML: (attributes) => {
          return {
            "data-scale": attributes.scale?.toString() ?? "100",
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[data-type="${this.name}"]`,
        getAttrs: (node: HTMLElement) => {
          return node.hasAttribute("data-typst") ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { 
        "data-type": this.name, 
        "data-typst": true,
        "data-edit-mode": HTMLAttributes.editMode ?? "display",
        "data-scale": HTMLAttributes.scale?.toString() ?? "100"
      },
      `${HTMLAttributes.text ?? ""}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },

  addCommands() {
    return {
      setTypstBlock:
        (attributes?: Record<string, any>) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              editMode: "display",
              scale: 100,
              ...attributes,
            },
          });
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: typstInputRegex,
        type: this.type,
        getAttributes: (match) => {
          let value = match[2] ?? "";
          if (value.startsWith("\n")) {
            value = value.slice(1);
          }
          if (value.endsWith("\n")) {
            value = value.slice(0, -1);
          }
          return {
            text: value,
          };
        },
      }),
    ];
  },
});