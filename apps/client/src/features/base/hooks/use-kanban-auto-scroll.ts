import { useEffect, RefObject } from "react";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";

export function useKanbanAutoScroll(
  ref: RefObject<HTMLElement | null>,
  canScroll: ({
    source,
  }: {
    source: { data: Record<string, unknown> };
  }) => boolean = () => true,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return autoScrollForElements({ element: el, canScroll });
  }, [ref, canScroll]);
}
