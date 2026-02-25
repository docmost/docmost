import { ReactNodeViewRenderer } from "@tiptap/react";
import { Range, Node, mergeAttributes, ResizableNodeView } from "@tiptap/core";
import type { ResizableNodeViewDirection } from "@tiptap/core";

export type VideoResizeOptions = {
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

export interface VideoOptions {
  view: any;
  HTMLAttributes: Record<string, any>;
  resize: VideoResizeOptions | false;
}

export interface VideoAttributes {
  src?: string;
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
    videoBlock: {
      setVideo: (attributes: VideoAttributes) => ReturnType;
      setVideoAt: (
        attributes: VideoAttributes & { pos: number | Range }
      ) => ReturnType;
      setVideoAlign: (align: "left" | "center" | "right") => ReturnType;
      setVideoWidth: (width: number) => ReturnType;
      setVideoSize: (width: number, height: number) => ReturnType;
    };
  }
}

export const TiptapVideo = Node.create<VideoOptions>({
  name: "video",

  group: "block",
  isolating: true,
  atom: true,
  defining: true,
  draggable: true,

  addOptions() {
    return {
      view: null,
      HTMLAttributes: {},
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
      attachmentId: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes: VideoAttributes) => ({
          "data-attachment-id": attributes.attachmentId,
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
        renderHTML: (attributes: VideoAttributes) => ({
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
        renderHTML: (attributes: VideoAttributes) => ({
          height: attributes.height,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-size"),
        renderHTML: (attributes: VideoAttributes) => ({
          "data-size": attributes.size,
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align"),
        renderHTML: (attributes: VideoAttributes) => ({
          "data-align": attributes.align,
        }),
      },
      aspectRatio: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-aspect-ratio"),
        renderHTML: (attributes: VideoAttributes) => ({
          "data-aspect-ratio": attributes.aspectRatio,
        }),
      },
      placeholder: {
        default: null,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      { controls: "true", ...HTMLAttributes },
      ["source", HTMLAttributes],
    ];
  },

  addCommands() {
    return {
      setVideo:
        (attrs: VideoAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "video",
            attrs: attrs,
          });
        },

      setVideoAlign:
        (align) =>
        ({ commands }) =>
          commands.updateAttributes("video", { align }),

      setVideoWidth:
        (width) =>
        ({ commands }) =>
          commands.updateAttributes("video", {
            width: `${Math.max(0, Math.min(100, width))}%`,
          }),

      setVideoSize:
        (width, height) =>
        ({ commands }) =>
          commands.updateAttributes("video", { width, height }),
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

      const el = document.createElement("video");
      el.src = node.attrs.src;
      el.controls = true;
      el.preload = "metadata";
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

      // Hide until video metadata loads
      dom.style.visibility = "hidden";
      dom.style.pointerEvents = "none";
      el.onloadedmetadata = () => {
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
