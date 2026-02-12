import { ReactRenderer, useEditor } from "@tiptap/react";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import MentionList from "@/features/editor/components/mention/mention-list.tsx";

function getWhitespaceCount(query: string) {
  const matches = query?.match(/([\s]+)/g);
  return matches?.length || 0;
}

const mentionRenderItems = () => {
  let component: ReactRenderer | null = null;
  let activeClientRect: (() => DOMRect) | null = null;
  let updatePositionCleanup: (() => void) | null = null;

  const destroy = () => {
    updatePositionCleanup?.();
    updatePositionCleanup = null;
    component?.destroy();
    if (component?.element?.parentNode) {
      component.element.parentNode.removeChild(component.element);
    }
    component = null;
  };

  return {
    onStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: () => DOMRect;
      query: string;
    }) => {
      // query must not start with a whitespace
      if (props.query.charAt(0) === " ") {
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

      activeClientRect = props.clientRect;

      const { element } = component;
      document.body.appendChild(element);

      updatePositionCleanup = autoUpdate(
        {
          getBoundingClientRect: () =>
            activeClientRect ? activeClientRect() : new DOMRect(),
        },
        element,
        () => {
          if (!component?.element) return;
          computePosition(
            {
              getBoundingClientRect: () => {
                return activeClientRect ? activeClientRect() : new DOMRect();
              },
            },
            element,
            {
              placement: "bottom-start",
              middleware: [offset(0), flip(), shift()],
            },
          ).then(({ x, y }) => {
            Object.assign(element.style, {
              left: `${x}px`,
              top: `${y}px`,
              position: "absolute",
              zIndex: "9999",
            });
          });
        },
      );
    },
    onUpdate: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: () => DOMRect;
      query: string;
    }) => {
      // query must not start with a whitespace
      if (props.query.charAt(0) === " ") {
        destroy();
        return;
      }

      // only update component if popup is not destroyed
      if (component) {
        component.updateProps(props);
      }

      if (!props || !props.clientRect) {
        return;
      }

      activeClientRect = props.clientRect;

      const whitespaceCount = getWhitespaceCount(props.query);

      // destroy component if space is greater 3 without a match
      if (
        whitespaceCount > 4 &&
        //@ts-ignore
        props.editor.storage.mentionItems.length === 1
      ) {
        destroy();
        return;
      }
      // fallback exit
      if (whitespaceCount > 7) {
        destroy();
        return;
      }
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.key === "Escape") {
        destroy();
        return true;
      }

      if (props.event.key === "Enter" && !component) {
        destroy();
        return false;
      }

      return (component?.ref as any)?.onKeyDown(props);
    },
    onExit: () => {
      destroy();
    },
  };
};

export default mentionRenderItems;
