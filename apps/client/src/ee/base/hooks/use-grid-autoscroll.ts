import { type RefObject, useEffect } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { unsafeOverflowAutoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/unsafe-overflow/element";
import { COLUMN_DRAG_TYPE } from "@/ee/base/components/grid/grid-header-cell";
import { ROW_DRAG_TYPE } from "@/ee/base/components/grid/grid-row";

const HEADER_BAND_REACH_PX = 60;
const EDGE_OUTWARD_REACH_PX = 80;

const EARLY_PAN_MARGIN_PX = 100;
const MIN_PAN_SPEED_PX = 3;
const MAX_PAN_SPEED_PX = 16;

export function useGridAutoScroll<T extends HTMLElement>(
  bodyRef: RefObject<T | null>,
  pageId: string,
): void {
  useEffect(() => {
    const element = bodyRef.current;
    if (!element) return;

    let rafId = 0;
    let pointerX: number | null = null;
    // Captured once at drag start: cursor-to-column-left-edge distance and column width.
    let grabOffsetX = 0;
    let columnWidth = 0;

    let lockedScrollLeft: number | null = null;
    const keepHorizontalScroll = () => {
      if (lockedScrollLeft !== null && element.scrollLeft !== lockedScrollLeft) {
        element.scrollLeft = lockedScrollLeft;
      }
    };

    function speedForDepth(distanceFromEdge: number): number {
      const depth = Math.min(1, (EARLY_PAN_MARGIN_PX - distanceFromEdge) / EARLY_PAN_MARGIN_PX);
      return MIN_PAN_SPEED_PX + (MAX_PAN_SPEED_PX - MIN_PAN_SPEED_PX) * depth;
    }

    function pan() {
      if (pointerX === null) {
        rafId = 0;
        return;
      }
      const rect = element.getBoundingClientRect();
      const columnLeft = pointerX - grabOffsetX;
      const columnRight = columnLeft + columnWidth;
      const fromLeft = columnLeft - rect.left;
      const fromRight = rect.right - columnRight;
      let delta = 0;
      if (fromLeft < EARLY_PAN_MARGIN_PX) {
        delta = -speedForDepth(fromLeft);
      } else if (fromRight < EARLY_PAN_MARGIN_PX) {
        delta = speedForDepth(fromRight);
      }
      if (delta !== 0) element.scrollLeft += delta;
      rafId = requestAnimationFrame(pan);
    }

    return combine(
      autoScrollForElements({
        element,
        canScroll: ({ source }) =>
          source.data?.type === COLUMN_DRAG_TYPE &&
          source.data?.pageId === pageId,
        getAllowedAxis: () => "horizontal" as const,
      }),
      unsafeOverflowAutoScrollForElements({
        element,
        canScroll: ({ source }) =>
          source.data?.type === COLUMN_DRAG_TYPE &&
          source.data?.pageId === pageId,
        getAllowedAxis: () => "horizontal" as const,
        getOverflow: () => ({
          forLeftEdge: { left: EDGE_OUTWARD_REACH_PX, top: HEADER_BAND_REACH_PX },
          forRightEdge: { right: EDGE_OUTWARD_REACH_PX, top: HEADER_BAND_REACH_PX },
        }),
      }),
      monitorForElements({
        canMonitor: ({ source }) =>
          source.data?.type === COLUMN_DRAG_TYPE && source.data?.pageId === pageId,
        onDragStart: ({ location, source }) => {
          const cr = source.element.getBoundingClientRect();
          grabOffsetX = location.current.input.clientX - cr.left;
          columnWidth = cr.width;
          pointerX = location.current.input.clientX;
          if (rafId === 0) rafId = requestAnimationFrame(pan);
        },
        onDrag: ({ location }) => {
          pointerX = location.current.input.clientX;
        },
        onDrop: () => {
          pointerX = null;
          if (rafId !== 0) {
            cancelAnimationFrame(rafId);
            rafId = 0;
          }
        },
      }),
      monitorForElements({
        canMonitor: ({ source }) =>
          source.data?.type === ROW_DRAG_TYPE && source.data?.pageId === pageId,
        onDragStart: () => {
          lockedScrollLeft = element.scrollLeft;
          element.addEventListener("scroll", keepHorizontalScroll);
        },
        onDrop: () => {
          element.removeEventListener("scroll", keepHorizontalScroll);
          lockedScrollLeft = null;
        },
      }),
      () => {
        if (rafId !== 0) cancelAnimationFrame(rafId);
        element.removeEventListener("scroll", keepHorizontalScroll);
      },
    );
  }, [bodyRef, pageId]);
}
