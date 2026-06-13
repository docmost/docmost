import type { ComponentType } from "react";
import { Editor } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";

export interface FloatingPopupHandle {
  destroy: () => void;
}

// Mounts a React component as a popup anchored at a doc position (floating-ui),
// dismissed on outside-click. Shared by the Linear search/create popups.
export function createEditorPopup<P extends object>(
  editor: Editor,
  Component: ComponentType<P>,
  buildProps: (handle: FloatingPopupHandle) => P,
  anchorPos: number,
): FloatingPopupHandle {
  let component: ReactRenderer | null = null;
  let outsideHandler: ((event: MouseEvent) => void) | null = null;
  let outsideHandlerTimeout: ReturnType<typeof setTimeout> | null = null;

  const handle: FloatingPopupHandle = {
    destroy: () => {
      // cancel the pending outside-click registration if it hasn't run yet,
      // so destroying before the deferred setTimeout fires doesn't leak a
      // listener bound to a detached element
      if (outsideHandlerTimeout) {
        clearTimeout(outsideHandlerTimeout);
        outsideHandlerTimeout = null;
      }
      if (outsideHandler) {
        document.removeEventListener("pointerdown", outsideHandler);
        outsideHandler = null;
      }
      component?.destroy();
      if (component?.element?.parentNode) {
        component.element.parentNode.removeChild(component.element);
      }
      component = null;
    },
  };

  component = new ReactRenderer(Component, {
    props: buildProps(handle),
    editor,
  });

  const element = component.element as HTMLElement;
  element.style.position = "absolute";
  element.style.zIndex = "300";
  // hide until floating-ui has positioned it, so it doesn't flash at 0,0
  element.style.visibility = "hidden";
  document.body.appendChild(element);

  const coords = editor.view.coordsAtPos(anchorPos);
  const virtualReference = {
    getBoundingClientRect: () =>
      new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top),
  };
  computePosition(virtualReference, element, {
    placement: "bottom-start",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  }).then(
    ({ x, y }) => {
      Object.assign(element.style, {
        left: `${x}px`,
        top: `${y}px`,
        visibility: "visible",
      });
    },
    // positioning failed; tear down rather than leaving a hidden orphan in <body>
    () => handle.destroy(),
  );

  // defer so the click that opened the popup doesn't immediately close it
  outsideHandlerTimeout = setTimeout(() => {
    outsideHandlerTimeout = null;
    outsideHandler = (event: MouseEvent) => {
      if (element && !element.contains(event.target as Node)) {
        handle.destroy();
      }
    };
    document.addEventListener("pointerdown", outsideHandler);
  }, 0);

  return handle;
}
