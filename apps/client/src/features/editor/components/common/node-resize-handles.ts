import type { ResizableNodeViewDirection } from "@tiptap/core";
import classes from "./node-resize.module.css";

export function createResizeHandle(
  direction: ResizableNodeViewDirection,
): HTMLElement {
  const handle = document.createElement("div");
  handle.dataset.resizeHandle = direction;
  handle.style.position = "absolute";
  handle.className = classes.handle;

  if (direction === "left") {
    handle.style.left = "-8px";
    handle.style.top = "0";
    handle.style.bottom = "0";
  } else if (direction === "right") {
    handle.style.right = "-8px";
    handle.style.top = "0";
    handle.style.bottom = "0";
  }

  const bar = document.createElement("div");
  bar.className = classes.handleBar;
  handle.appendChild(bar);

  return handle;
}

export function buildResizeClasses(nodeClass: string) {
  return {
    container: `${classes.container} ${nodeClass}`,
    wrapper: classes.wrapper,
    resizing: classes.resizing,
  };
}
