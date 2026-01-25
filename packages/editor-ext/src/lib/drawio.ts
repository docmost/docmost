import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface DrawioOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}
export interface DrawioAttributes {
  src?: string;
  title?: string;
  size?: number;
  width?: string;
  align?: string;
  attachmentId?: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    drawio: {
      setDrawio: (attributes?: DrawioAttributes) => ReturnType;
    };
  }
}

export const Drawio = Node.create<DrawioOptions>({
  name: "drawio",
  inline: false,
  group: "block",
  isolating: true,
  atom: true,
  defining: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-src"),
        renderHTML: (attributes) => ({
          "data-src": attributes.src,
        }),
      },
      title: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes: DrawioAttributes) => ({
          "data-title": attributes.title,
        }),
      },
      width: {
        default: "100%",
        parseHTML: (element) => element.getAttribute("data-width"),
        renderHTML: (attributes: DrawioAttributes) => ({
          "data-width": attributes.width,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-size"),
        renderHTML: (attributes: DrawioAttributes) => ({
          "data-size": attributes.size,
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align"),
        renderHTML: (attributes: DrawioAttributes) => ({
          "data-align": attributes.align,
        }),
      },
      attachmentId: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes: DrawioAttributes) => ({
          "data-attachment-id": attributes.attachmentId,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      [
        "img",
        {
          src: HTMLAttributes["data-src"],
          alt: HTMLAttributes["data-title"],
          width: HTMLAttributes["data-width"],
        },
      ],
    ];
  },

  addCommands() {
    return {
      setDrawio:
        (attrs: DrawioAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "drawio",
            attrs: attrs,
          });
        },
    };
  },

  addNodeView() {
    // Force the react node view to render immediately using flush sync (https://github.com/ueberdosis/tiptap/blob/b4db352f839e1d82f9add6ee7fb45561336286d8/packages/react/src/ReactRenderer.tsx#L183-L191)
    this.editor.isInitialized = true;

    return ReactNodeViewRenderer(this.options.view);
  },
});
