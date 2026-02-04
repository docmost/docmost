import { ReactRenderer, useEditor } from "@tiptap/react";
import EmojiList from "./emoji-list";
import { init } from "emoji-mart";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";

const renderEmojiItems = () => {
  let component: ReactRenderer | null = null;
  let popup: HTMLDivElement | null = null;
  let cleanup: (() => void) | null = null;
  let getReferenceClientRect: (() => DOMRect) | null = null;

  const destroy = () => {
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
  };

  return {
    onBeforeStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: () => DOMRect;
    }) => {
      init({
        data: async () => (await import("@emoji-mart/data")).default,
      });

      component = new ReactRenderer(EmojiList, {
        props: { isLoading: true, items: [] },
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      getReferenceClientRect = props.clientRect;
      popup = document.createElement("div");
      popup.style.zIndex = "9999";
      popup.style.position = "absolute";
      popup.style.top = "0";
      popup.style.left = "0";
      popup.appendChild(component.element);
      document.body.appendChild(popup);

      const virtualElement = {
        getBoundingClientRect: () => {
          return getReferenceClientRect
            ? getReferenceClientRect()
            : new DOMRect(0, 0, 0, 0);
        },
      };

      cleanup = autoUpdate(virtualElement, popup, () => {
        if (!popup) return;

        computePosition(virtualElement, popup, {
          placement: "bottom-start",
          middleware: [offset(10), flip(), shift()],
        }).then(({ x, y }) => {
          if (!popup) return;

          Object.assign(popup.style, {
            transform: `translate(${x}px, ${y}px)`,
          });
        });
      });
    },
    onStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: () => DOMRect;
    }) => {
      component?.updateProps({ ...props, isLoading: false });

      if (props.clientRect) {
        getReferenceClientRect = props.clientRect;
      }
    },
    onUpdate: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: () => DOMRect;
    }) => {
      component?.updateProps(props);

      if (props.clientRect) {
        getReferenceClientRect = props.clientRect;
      }
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.key === "Escape") {
        destroy();

        return true;
      }

      // @ts-ignore
      return component?.ref?.onKeyDown(props);
    },
    onExit: () => {
      destroy();
    },
  };
};

export default renderEmojiItems;
