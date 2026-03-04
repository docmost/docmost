import { Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export function normalizeFileUrl(src: string): string {
  if (src && src.startsWith("/files/")) {
    return "/api" + src;
  }
  return src || "";
}

export function applyAlignment(container: HTMLElement, align: string) {
  if (align === "left") {
    container.style.justifyContent = "flex-start";
  } else if (align === "right") {
    container.style.justifyContent = "flex-end";
  } else {
    container.style.justifyContent = "center";
  }
}

export function createPlaceholderView(viewComponent: any, props: any) {
  const { node, editor } = props;
  editor.isInitialized = true;
  const reactView = ReactNodeViewRenderer(viewComponent);
  const view = reactView(props);

  const originalUpdate = view.update?.bind(view);
  view.update = (updatedNode: any, decorations: any, innerDecorations: any) => {
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

export function setupMediaLoading(
  dom: HTMLElement,
  el: HTMLElement,
  node: any,
  loadEvent: "load" | "loadedmetadata" = "load",
) {
  applyAlignment(dom, node.attrs.align || "center");

  const widthAttr = node.attrs.width;
  if (typeof widthAttr === "string" && widthAttr.endsWith("%")) {
    requestAnimationFrame(() => {
      const parentEl = dom.parentElement;
      if (parentEl) {
        const containerWidth = parentEl.clientWidth;
        const pctValue = parseInt(widthAttr, 10);
        if (!isNaN(pctValue) && containerWidth > 0) {
          const pxWidth = Math.round(containerWidth * (pctValue / 100));
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

  dom.style.pointerEvents = "none";
  dom.style.background =
    "light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-6))";

  el.addEventListener(
    loadEvent,
    () => {
      dom.style.pointerEvents = "";
      dom.style.background = "";
    },
    { once: true },
  );
}

export type UploadFn = (
  file: File,
  editor: Editor,
  pos: number,
  pageId: string,
  // only applicable to file attachments
  allowMedia?: boolean,
) => void;

export interface MediaUploadOptions {
  validateFn?: (file: File, allowMedia?: boolean) => void;
  onUpload: (file: File, pageId: string) => Promise<any>;
}
