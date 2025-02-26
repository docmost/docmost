import { ReactRenderer, useEditor } from "@tiptap/react";
import tippy from "tippy.js";
import MentionList from "@/features/editor/components/mention/mention-list.tsx";

function getWhitespaceCount(query: string) {
  const matches = query?.match(/([\s]+)/g);
  return matches?.length || 0;
}

const mentionRenderItems = () => {
  let component: ReactRenderer | null = null;
  let popup: any | null = null;

  return {
    onStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
      query: string;
    }) => {
      // query must not start with a whitespace
      if (props.query.charAt(0) === ' '){
        return;
      }

      // don't render component if space between the search query words is greater than 4
      const whitespaceCount = getWhitespaceCount(props.query);
      if (whitespaceCount > 4) {
        return;
      }

      component = new ReactRenderer(MentionList, {
        props,
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
        placement: "bottom-start",
      });
    },
    onUpdate: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
      query: string;
    }) => {
      // query must not start with a whitespace
      if (props.query.charAt(0) === ' '){
        component?.destroy();
        return;
      }

      // only update component if popup is not destroyed
      if (!popup?.[0].state.isDestroyed) {
        component?.updateProps(props);
      }

      if (!props || !props.clientRect) {
        return;
      }

      const whitespaceCount = getWhitespaceCount(props.query);

      // destroy component if space is greater 3 without a match
      if (
        whitespaceCount > 3 &&
        props.editor.storage.mentionItems.length === 0
      ) {
        popup?.[0]?.destroy();
        component?.destroy();
        return;
      }

      popup &&
        !popup?.[0].state.isDestroyed &&
        popup?.[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.key)
        if (
          props.event.key === "Escape" ||
          (props.event.key === "Enter" && !popup?.[0].state.isShown)
        ) {
          popup?.[0].destroy();
          component?.destroy();
          return false;
        }
      return (component?.ref as any)?.onKeyDown(props);
    },
    onExit: () => {
      if (popup && !popup?.[0].state.isDestroyed) {
        popup[0].destroy();
      }

      if (component) {
        component.destroy();
      }
    },
  };
};

export default mentionRenderItems;
