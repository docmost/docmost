import { useEffect } from "react";
import {
  autoScrollForElements,
  autoScrollWindowForElements,
} from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { ROW_DRAG_TYPE } from "@/ee/base/components/grid/grid-row";

export function useRowAutoScroll(
  scrollElement: HTMLElement | Window | null,
  pageId: string,
): void {
  useEffect(() => {
    if (!scrollElement) return;
    if (scrollElement === window) {
      return autoScrollWindowForElements({
        canScroll: ({ source }) =>
          source.data?.type === ROW_DRAG_TYPE && source.data?.pageId === pageId,
        getAllowedAxis: () => "vertical" as const,
      });
    }
    return autoScrollForElements({
      element: scrollElement as HTMLElement,
      canScroll: ({ source }) =>
        source.data?.type === ROW_DRAG_TYPE && source.data?.pageId === pageId,
      getAllowedAxis: () => "vertical" as const,
    });
  }, [scrollElement, pageId]);
}
