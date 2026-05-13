import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { disableNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview";
import {
  autoScrollForElements,
  autoScrollWindowForElements,
} from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { getTableHandlePluginSpec } from "@docmost/editor-ext";

// Uses pragmatic-drag-and-drop instead of native HTML5 DnD because the native
// dragstart→dragover→drop lifecycle was being silently cancelled
export function useTableHandleDrag(
  editor: Editor,
  orientation: "col" | "row",
  element: HTMLElement | null,
  wrapper: HTMLElement | null,
  onDragStart?: () => void,
) {
  useEffect(() => {
    if (!element) return;

    return combine(
      draggable({
        element,
        getInitialData: () => ({ type: `table-${orientation}` }),
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          // We render our own floating preview via PreviewController, so hide
          // the native drag image entirely.
          disableNativeDragPreview({ nativeSetDragImage });
        },
        onDragStart: ({ location }) => {
          // The menu (if open from a prior click on the handle) won't dismiss
          // on its own — pragmatic-dnd swallows the events Mantine listens for.
          onDragStart?.();
          const spec = getTableHandlePluginSpec(editor);
          if (!spec) return;
          const { clientX, clientY } = location.initial.input;
          spec.startDragFromHandle(orientation, clientX, clientY);
        },
        onDrag: ({ location }) => {
          const spec = getTableHandlePluginSpec(editor);
          if (!spec) return;
          const { clientX, clientY } = location.current.input;
          spec.updateDragPosition(clientX, clientY);
        },
        onDrop: ({ location }) => {
          const spec = getTableHandlePluginSpec(editor);
          if (!spec) return;
          const { clientX, clientY } = location.current.input;
          // Make sure the final position is recorded before committing the drop.
          spec.updateDragPosition(clientX, clientY);
          spec.commitDrop();
          spec.endDrag();
        },
      }),
      // Wrapper owns horizontal auto-scroll (it has `overflow-x: auto`);
      // window owns vertical. Locking each axis prevents the window's
      // horizontal auto-scroll from running when the cursor approaches
      // the viewport edge — without the cap, the preview's `left` follows
      // the cursor past the viewport, the page widens to contain it, the
      // plugin scrolls the now-wider page further, and the loop never
      // ends.
      // Only the column handle registers wrapper auto-scroll (rows can't
      // scroll horizontally) — registering twice on the same wrapper
      // triggers a dev-mode warning from pragmatic-dnd-auto-scroll.
      orientation === "col" &&
      wrapper &&
      !wrapper.classList.contains("tableWrapperNoOverflow")
        ? autoScrollForElements({
            element: wrapper,
            getAllowedAxis: () => "horizontal",
          })
        : () => {},
      autoScrollWindowForElements({ getAllowedAxis: () => "vertical" }),
    );
  }, [editor, orientation, element, wrapper, onDragStart]);
}
