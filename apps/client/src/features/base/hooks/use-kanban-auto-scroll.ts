import { useEffect, RefObject } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { unsafeOverflowAutoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/unsafe-overflow/element";

type CanScrollArgs = {
  source: { data: Record<string, unknown> };
};

// How far past each edge the cursor can roam and still drive scroll.
// 120px gives users a generous "drag past the column" affordance before
// scrolling stops — matches what other kanbans (Linear, Notion) do.
const OVERFLOW_PX = 120;

export function useKanbanAutoScroll(
  ref: RefObject<HTMLElement | null>,
  canScroll: (args: CanScrollArgs) => boolean = () => true,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return combine(
      autoScrollForElements({
        element: el,
        canScroll,
        getConfiguration: () => ({ maxScrollSpeed: "fast" }),
      }),
      unsafeOverflowAutoScrollForElements({
        element: el,
        canScroll,
        getConfiguration: () => ({ maxScrollSpeed: "fast" }),
        getOverflow: () => ({
          forTopEdge: { top: OVERFLOW_PX },
          forBottomEdge: { bottom: OVERFLOW_PX },
          forLeftEdge: { left: OVERFLOW_PX },
          forRightEdge: { right: OVERFLOW_PX },
        }),
      }),
    );
  }, [ref, canScroll]);
}
