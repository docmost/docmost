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
  height?: string | number | null;
}

export const typstInputRegex =
  /(?:^|\s)(```typst(?:[ \t]*\n)?([\s\S]+?)```)[\t ]*$/;

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
    const normalizeHeight = (
      value: string | number | null | undefined
    ): string | null => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value === "number") {
        if (!Number.isFinite(value)) {
          return null;
        }
        return `${value}px`;
      }

      const trimmed = value.trim();

      if (!trimmed.length) {
        return null;
      }

      if (trimmed.toLowerCase() === "auto") {
        return null;
      }

      if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        const numeric = Number.parseFloat(trimmed);
        if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
          return `${numeric}px`;
        }
      }

      return trimmed;
    };

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
      height: {
        default: null,
        parseHTML: (element) => {
          const heightAttr = element.getAttribute("data-height");
          return normalizeHeight(heightAttr);
        },
        renderHTML: (attributes) => {
          const normalized = normalizeHeight(attributes.height);

          if (!normalized) {
            return {};
          }

          return {
            "data-height": normalized,
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
    const attrs: Record<string, string> = {
      "data-type": this.name,
      "data-typst": "true",
      "data-edit-mode": HTMLAttributes.editMode ?? "display",
      "data-scale": HTMLAttributes.scale?.toString() ?? "100",
    };

    if (HTMLAttributes.height !== null && HTMLAttributes.height !== undefined) {
      attrs["data-height"] = HTMLAttributes.height.toString();
    }

    return ["div", attrs, `${HTMLAttributes.text ?? ""}`];
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
