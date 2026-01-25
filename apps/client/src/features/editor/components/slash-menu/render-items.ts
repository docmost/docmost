import { ReactRenderer, useEditor } from "@tiptap/react";
import CommandList from "@/features/editor/components/slash-menu/command-list";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";

const renderItems = () => {
  let component: ReactRenderer | null = null;
  let popup: HTMLElement | null = null;
  let cleanup: (() => void) | null = null;
  let getReferenceClientRect: (() => DOMRect) | null = null;

  const updatePosition = () => {
    if (!popup || !getReferenceClientRect) return;

    // @ts-ignore
    const rect = getReferenceClientRect();

    computePosition({ getBoundingClientRect: () => rect }, popup, {
      placement: "bottom-start",
      middleware: [offset(0), flip(), shift()],
    }).then(({ x, y }) => {
      if (popup) {
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;
      }
    });
  };

  return {
    onStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
    }) => {
      component = new ReactRenderer(CommandList, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      // @ts-ignore
      getReferenceClientRect = props.clientRect;

      popup = document.createElement("div");
      popup.style.zIndex = "9999";
      popup.style.position = "absolute";
      popup.style.top = "0";
      popup.style.left = "0";

      document.body.appendChild(popup);
      popup.appendChild(component.element);

      cleanup = autoUpdate(
        // @ts-ignore
        {
          getBoundingClientRect: () => {
            return getReferenceClientRect
              ? getReferenceClientRect()
              : new DOMRect();
          },
        },
        popup,
        updatePosition
      );
    },
    onUpdate: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
    }) => {
      component?.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      // @ts-ignore
      getReferenceClientRect = props.clientRect;
      updatePosition();
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.key === "Escape") {
        if (popup) {
          popup.style.display = "none";
        }

        return true;
      }

      // @ts-ignore
      return component?.ref?.onKeyDown(props);
    },
    onExit: () => {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }

      if (popup) {
        popup.remove();
        popup = null;
      }

      if (component) {
        component.destroy();
        component = null;
      }
    },
  };
};

export default renderItems;
