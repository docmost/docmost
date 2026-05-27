import { useEffect, RefObject } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { unsafeOverflowAutoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/unsafe-overflow/element";

type CanScrollArgs = {
  source: { data: Record<string, unknown> };
};

const OVERFLOW_PX = 6000;

type Axis = "horizontal" | "vertical";

export function useKanbanAutoScroll(
  ref: RefObject<HTMLElement | null>,
  axis: Axis,
  canScroll: (args: CanScrollArgs) => boolean = () => true,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const overflow =
      axis === "vertical"
        ? {
            forTopEdge: { top: OVERFLOW_PX, right: 0, left: 0 },
            forBottomEdge: { bottom: OVERFLOW_PX, right: 0, left: 0 },
            forLeftEdge: { left: 0, top: 0, bottom: 0 },
            forRightEdge: { right: 0, top: 0, bottom: 0 },
          }
        : {
            forTopEdge: { top: 0, right: 0, left: 0 },
            forBottomEdge: { bottom: 0, right: 0, left: 0 },
            forLeftEdge: { left: OVERFLOW_PX, top: 0, bottom: 0 },
            forRightEdge: { right: OVERFLOW_PX, top: 0, bottom: 0 },
          };
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
        getOverflow: () => overflow,
      }),
    );
  }, [ref, axis, canScroll]);
}
