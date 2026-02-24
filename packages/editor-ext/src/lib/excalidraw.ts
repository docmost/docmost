import { Node, mergeAttributes, ResizableNodeView } from "@tiptap/core";
import type { ResizableNodeViewDirection } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export type ExcalidrawResizeOptions = {
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

export interface ExcalidrawOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
  resize: ExcalidrawResizeOptions | false;
}

export interface ExcalidrawAttributes {
  src?: string;
  title?: string;
  size?: number;
  width?: number | string;
  height?: number;
  aspectRatio?: number;
  align?: string;
  attachmentId?: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    excalidraw: {
      setExcalidraw: (attributes?: ExcalidrawAttributes) => ReturnType;
      setExcalidrawAlign: (align: "left" | "center" | "right") => ReturnType;
      setExcalidrawSize: (width: number, height: number) => ReturnType;
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
      resize: false,
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
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-width");
          if (!raw) return null;
          if (raw.endsWith("%")) return raw;
          const num = parseFloat(raw);
          return isNaN(num) ? null : num;
        },
        renderHTML: (attributes: ExcalidrawAttributes) => ({
          "data-width": attributes.width,
        }),
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-height");
          if (!raw) return null;
          const num = parseFloat(raw);
          return isNaN(num) ? null : num;
        },
        renderHTML: (attributes: ExcalidrawAttributes) => ({
          "data-height": attributes.height,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-size"),
        renderHTML: (attributes: ExcalidrawAttributes) => ({
          "data-size": attributes.size,
        }),
      },
      aspectRatio: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-aspect-ratio"),
        renderHTML: (attributes: ExcalidrawAttributes) => ({
          "data-aspect-ratio": attributes.aspectRatio,
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
        HTMLAttributes,
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

      setExcalidrawAlign:
        (align) =>
        ({ commands }) =>
          commands.updateAttributes("excalidraw", { align }),

      setExcalidrawSize:
        (width, height) =>
        ({ commands }) =>
          commands.updateAttributes("excalidraw", { width, height }),
    };
  },

  addNodeView() {
    const resize = this.options.resize;

    if (!resize || !resize.enabled) {
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

      if (!node.attrs.src) {
        editor.isInitialized = true;
        const reactView = ReactNodeViewRenderer(this.options.view);
        const view = reactView(props);

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

      const el = document.createElement("img");
      el.src = node.attrs.src;
      el.alt = node.attrs.title || "";
      el.style.display = "block";
      el.style.maxWidth = "100%";
      el.style.borderRadius = "8px";

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
            el.src = updatedNode.attrs.src || "";
          }

          const w = updatedNode.attrs.width;
          const h = updatedNode.attrs.height;
          if (w != null) {
            el.style.width = `${w}px`;
          }
          if (h != null) {
            el.style.height = `${h}px`;
          }

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

      const dom = nodeView.dom as HTMLElement;

      applyAlignment(dom, node.attrs.align || "center");

      // Handle percentage width backward compat
      const widthAttr = node.attrs.width;
      if (typeof widthAttr === "string" && widthAttr.endsWith("%")) {
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

      // Hide until image loads
      dom.style.visibility = "hidden";
      dom.style.pointerEvents = "none";
      el.onload = () => {
        dom.style.visibility = "";
        dom.style.pointerEvents = "";
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
