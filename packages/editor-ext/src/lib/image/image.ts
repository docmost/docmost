import Image from "@tiptap/extension-image";
import { ImageOptions as DefaultImageOptions } from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  mergeAttributes,
  Range,
  ResizableNodeView,
} from "@tiptap/core";
import { normalizeFileUrl } from "../media-utils";
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
  getAttachmentMetadata?: (id: string) => Promise<any>;
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
  updatedAt?: number;
  cropMetadata?: {
    x: number;
    y: number;
    width: number;
    height: number;
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
      getAttachmentMetadata: null,
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
      updatedAt: {
        default: null,
        rendered: false,
      },
      cropMetadata: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-crop-metadata");
          return raw ? JSON.parse(raw) : null;
        },
        renderHTML: (attributes: ImageAttributes) => ({
          "data-crop-metadata": attributes.cropMetadata
            ? JSON.stringify(attributes.cropMetadata)
            : null,
        }),
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
    const { resize, getAttachmentMetadata } = this.options;

    return (props: any) => {
      const { node, getPos, HTMLAttributes, editor } = props;

      // Fetch metadata if missing but attachmentId is present
      if (node.attrs.attachmentId && !node.attrs.cropMetadata && typeof getAttachmentMetadata === 'function') {
        getAttachmentMetadata(node.attrs.attachmentId).then(metadata => {
          if (metadata?.cropMetadata) {
            const pos = getPos();
            if (typeof pos === 'number') {
              editor.commands.updateAttributes(node.type.name, {
                cropMetadata: metadata.cropMetadata,
                updatedAt: Date.now()
              });
            }
          }
        }).catch(() => {});
      }

      if (!resize || !resize.enabled) {
        // Fallback to React node view (existing behavior)
        this.editor.isInitialized = true;
        return ReactNodeViewRenderer(this.options.view)(props);
      }

      const {
        directions,
        minWidth,
        minHeight,
        alwaysPreserveAspectRatio,
        createCustomHandle,
        className,
      } = resize;

      // If no src yet (placeholder/uploading), use React view for loading UI
      if (!HTMLAttributes.src) {
        const reactView = ReactNodeViewRenderer(this.options.view);
        const view = reactView(props);

        // When the node gets a src, return false from update to force rebuild
        const originalUpdate = view.update?.bind(view);
        view.update = (updatedNode, decorations, innerDecorations) => {
          if (updatedNode.attrs.src && !node.attrs.src) {
            return false;
          }
          if (originalUpdate) {
            return originalUpdate(updatedNode, decorations, innerDecorations);
          }
          return true;
        };

        return view;
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

      applyCropStyles(el, node.attrs.cropMetadata);

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

          if (updatedNode.attrs.cropMetadata !== currentNode.attrs.cropMetadata) {
            applyCropStyles(el, updatedNode.attrs.cropMetadata);
          }

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

      const dom = nodeView.dom as HTMLElement;

      // Apply initial alignment
      applyAlignment(dom, node.attrs.align || "center");

      // Handle percentage width backward compat
      const widthAttr = node.attrs.width;
      if (typeof widthAttr === "string" && widthAttr.endsWith("%")) {
        // Defer conversion until we can measure the container
        requestAnimationFrame(() => {
          const parentEl = dom.parentElement;
          if (parentEl) {
            const containerWidth = parentEl.clientWidth;
            const pctValue = parseInt(widthAttr, 10);
            if (!isNaN(pctValue) && containerWidth > 0) {
              const pxWidth = Math.round(
                containerWidth * (pctValue / 100),
              );
              el.style.width = `${pxWidth}px`;
              if (node.attrs.aspectRatio) {
                el.style.height = `${Math.round(pxWidth / node.attrs.aspectRatio)}px`;
              }
            }
          }
          dom.style.visibility = "";
          dom.style.pointerEvents = "";
        });
      }

      // Show skeleton background while image loads from server
      dom.style.pointerEvents = "none";
      dom.style.background =
        "light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-6))";

      el.onload = () => {
        dom.style.pointerEvents = "";
        dom.style.background = "";
      };

      return nodeView;
    };
  },
});

function applyAlignment(container: HTMLElement, align: string) {
  if (align === "left") {
    container.style.justifyContent = "flex-start";
  } else if (align === "right") {
    container.style.justifyContent = "flex-end";
  } else {
    container.style.justifyContent = "center";
  }
}

function applyCropStyles(el: HTMLImageElement, cropMetadata: any) {
  if (!el) return;

  if (cropMetadata) {
    const { x, y, width: w, height: h } = cropMetadata;
    const nw = el.naturalWidth;
    const nh = el.naturalHeight;
    
    if (nw > 0 && nh > 0) {
        const scale = 100 / (w / nw * 100);
        
        el.style.position = "absolute";
        el.style.top = "0";
        el.style.left = "0";
        el.style.maxWidth = "none";
        el.style.width = `${scale * 100}%`;
        el.style.height = "auto";
        el.style.marginLeft = `-${(x / nw) * scale * 100}%`;
        el.style.marginTop = `-${(y / nh) * scale * 100}%`;
        el.style.clipPath = ""; // Remove old clip-path if present

        const wrapper = el.parentElement;
        if (wrapper) {
            wrapper.style.overflow = "hidden";
            wrapper.style.position = "relative";
            wrapper.style.aspectRatio = `${w / h}`;
        }
    } else {
        // Wait for load
        el.addEventListener('load', () => applyCropStyles(el, cropMetadata), { once: true });
    }
  } else {
    el.style.width = "100%";
    el.style.height = "auto";
    el.style.marginLeft = "0";
    el.style.marginTop = "0";
    el.style.position = "static";
    el.style.clipPath = "";
    const wrapper = el.parentElement;
    if (wrapper) {
        wrapper.style.aspectRatio = "";
    }
  }
}
