import Image from "@tiptap/extension-image";
import { ImageOptions as DefaultImageOptions } from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  mergeAttributes,
  Range,
  ResizableNodeView,
} from "@tiptap/core";
import {
  normalizeFileUrl,
  applyAlignment,
  createPlaceholderView,
  setupMediaLoading,
} from "../media-utils";
import type { ResizableNodeViewDirection } from "@tiptap/core";

export type ImageResizeOptions = {
  enabled: boolean;
  directions?: ResizableNodeViewDirection[];
  minWidth?: number;
  minHeight?: number;
  alwaysPreserveAspectRatio?: boolean;
  createCustomHandle?: (direction: ResizableNodeViewDirection) => HTMLElement;
  className?: {
    container?: string;
    wrapper?: string;
    handle?: string;
    resizing?: string;
  };
};

export interface ImageOptions extends DefaultImageOptions {
  view: any;
  resize: ImageResizeOptions | false;
}

export interface ImageAttributes {
  src?: string;
  alt?: string;
  align?: string;
  attachmentId?: string;
  size?: number;
  width?: number | string;
  height?: number;
  aspectRatio?: number;
  placeholder?: {
    id: string;
    name: string;
  };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageBlock: {
      setImage: (attributes: ImageAttributes) => ReturnType;
      setImageAt: (
        attributes: ImageAttributes & { pos: number | Range },
      ) => ReturnType;
      setImageAlign: (align: "left" | "center" | "right") => ReturnType;
      setImageWidth: (width: number) => ReturnType;
      setImageSize: (width: number, height: number) => ReturnType;
    };
  }
}

export const TiptapImage = Image.extend<ImageOptions>({
  name: "image",

  inline: false,
  group: "block",
  isolating: true,
  atom: true,
  defining: true,

  addOptions() {
    return {
      ...this.parent?.(),
      view: null,
      resize: false,
    };
  },

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute("src"),
        renderHTML: (attributes) => ({
          src: attributes.src,
        }),
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("width");
          if (!raw) return null;
          if (raw.endsWith("%")) return raw;
          const num = parseFloat(raw);
          return isNaN(num) ? null : num;
        },
        renderHTML: (attributes: ImageAttributes) => ({
          width: attributes.width,
        }),
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("height");
          if (!raw) return null;
          const num = parseFloat(raw);
          return isNaN(num) ? null : num;
        },
        renderHTML: (attributes: ImageAttributes) => ({
          height: attributes.height,
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align"),
        renderHTML: (attributes: ImageAttributes) => ({
          "data-align": attributes.align,
        }),
      },
      alt: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("alt"),
        renderHTML: (attributes: ImageAttributes) => ({
          alt: attributes.alt,
        }),
      },
      attachmentId: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes: ImageAttributes) => ({
          "data-attachment-id": attributes.attachmentId,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-size"),
        renderHTML: (attributes: ImageAttributes) => ({
          "data-size": attributes.size,
        }),
      },
      aspectRatio: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-aspect-ratio"),
        renderHTML: (attributes: ImageAttributes) => ({
          "data-aspect-ratio": attributes.aspectRatio,
        }),
      },
      placeholder: {
        default: null,
        rendered: false,
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
    ];
  },

  addCommands() {
    return {
      setImage:
        (attrs: ImageAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "image",
            attrs: attrs,
          });
        },

      setImageAt:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContentAt(attrs.pos, {
            type: "image",
            attrs: attrs,
          });
        },

      setImageAlign:
        (align) =>
        ({ commands }) =>
          commands.updateAttributes("image", { align }),

      setImageWidth:
        (width) =>
        ({ commands }) =>
          commands.updateAttributes("image", { width }),

      setImageSize:
        (width, height) =>
        ({ commands }) =>
          commands.updateAttributes("image", { width, height }),
    };
  },

  addNodeView() {
    const resize = this.options.resize;

    if (!resize || !resize.enabled) {
      // Fallback to React node view (existing behavior)
      this.editor.isInitialized = true;
      return ReactNodeViewRenderer(this.options.view);
    }

    const {
      directions,
      minWidth,
      minHeight,
      alwaysPreserveAspectRatio,
      createCustomHandle,
      className,
    } = resize;

    return (props) => {
      const { node, getPos, HTMLAttributes, editor } = props;

      if (!HTMLAttributes.src) {
        return createPlaceholderView(this.options.view, props);
      }

      // Has src — use ResizableNodeView
      const el = document.createElement("img");

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value != null) {
          switch (key) {
            case "width":
            case "height":
              break;
            default:
              el.setAttribute(key, String(value));
              break;
          }
        }
      });

      el.src = normalizeFileUrl(HTMLAttributes.src);
      el.style.display = "block";
      el.style.maxWidth = "100%";
      el.style.borderRadius = "8px";

      if (typeof node.attrs.width === "number" && node.attrs.width > 0) {
        el.style.width = `${node.attrs.width}px`;
        if (typeof node.attrs.height === "number" && node.attrs.height > 0) {
          el.style.height = `${node.attrs.height}px`;
        }
      }

      let currentNode = node;

      const nodeView = new ResizableNodeView({
        element: el,
        editor,
        node,
        getPos,
        onResize: (w, h) => {
          el.style.width = `${w}px`;
          el.style.height = `${h}px`;
        },
        onCommit: () => {
          const pos = getPos();
          if (pos === undefined) return;

          this.editor
            .chain()
            .setNodeSelection(pos)
            .updateAttributes(this.name, {
              width: Math.round(el.offsetWidth),
              height: Math.round(el.offsetHeight),
            })
            .run();
        },
        onUpdate: (updatedNode, _decorations, _innerDecorations) => {
          if (updatedNode.type !== currentNode.type) {
            return false;
          }

          if (updatedNode.attrs.src !== currentNode.attrs.src) {
            el.src = normalizeFileUrl(updatedNode.attrs.src);
          }

          if (updatedNode.attrs.alt !== currentNode.attrs.alt) {
            el.alt = updatedNode.attrs.alt || "";
          }

          const w = updatedNode.attrs.width;
          const h = updatedNode.attrs.height;
          if (w != null) {
            el.style.width = `${w}px`;
          }
          if (h != null) {
            el.style.height = `${h}px`;
          }

          // Update alignment on container
          const align = updatedNode.attrs.align || "center";
          const container = nodeView.dom as HTMLElement;
          applyAlignment(container, align);

          currentNode = updatedNode;
          return true;
        },
        options: {
          directions,
          min: {
            width: minWidth,
            height: minHeight,
          },
          preserveAspectRatio: alwaysPreserveAspectRatio === true,
          createCustomHandle,
          className,
        },
      });

      setupMediaLoading(nodeView.dom as HTMLElement, el, node);

      return nodeView;
    };
  },
});

