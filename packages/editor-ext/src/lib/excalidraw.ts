import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface ExcalidrawOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}
export interface ExcalidrawAttributes {
  src?: string;
  title?: string;
  size?: number;
  width?: string;
  align?: string;
  attachmentId?: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    excalidraw: {
      setExcalidraw: (attributes?: ExcalidrawAttributes) => ReturnType;
    };
  }
}

export const Excalidraw = Node.create<ExcalidrawOptions>({
  name: "excalidraw",
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
        renderHTML: (attributes: ExcalidrawAttributes) => ({
          "data-title": attributes.title,
        }),
      },
      width: {
        default: "100%",
        parseHTML: (element) => element.getAttribute("data-width"),
        renderHTML: (attributes: ExcalidrawAttributes) => ({
          "data-width": attributes.width,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-size"),
        renderHTML: (attributes: ExcalidrawAttributes) => ({
          "data-size": attributes.size,
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align"),
        renderHTML: (attributes: ExcalidrawAttributes) => ({
          "data-align": attributes.align,
        }),
      },
      attachmentId: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes: ExcalidrawAttributes) => ({
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
      setExcalidraw:
        (attrs: ExcalidrawAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "excalidraw",
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
