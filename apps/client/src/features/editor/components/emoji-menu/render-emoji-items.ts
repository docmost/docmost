import { ReactRenderer, useEditor } from "@tiptap/react";
import EmojiList from "./emoji-list";
import tippy from "tippy.js";
import { init } from "emoji-mart";

const renderEmojiItems = () => {
  let component: ReactRenderer | null = null;
  let popup: any | null = null;

  return {
    onBeforeStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
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

      // @ts-ignore
      popup = tippy("body", {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom",
      });
    },
    onStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
    }) => {
      component?.updateProps({...props, isLoading: false});

      if (!props.clientRect) {
        return;
      }

      popup &&
        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
    },
    onUpdate: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
    }) => {
      component?.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      popup &&
        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.key === "Escape") {
        popup?.[0].hide();
        component?.destroy()

        return true;
      }

      // @ts-ignore
      return component?.ref?.onKeyDown(props);
    },
    onExit: () => {
      if (popup && !popup[0]?.state.isDestroyed) {
        popup[0]?.destroy();
      }

      if (component) {
        component?.destroy();
      }
    },
  };
};

export default renderEmojiItems;
