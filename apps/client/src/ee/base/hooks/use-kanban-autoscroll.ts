import { type RefObject, useEffect } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { unsafeOverflowAutoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/unsafe-overflow/element";
import { KANBAN_CARD_DRAG_TYPE, KANBAN_COLUMN_DRAG_TYPE } from "@/ee/base/types/base.types";

const HEADER_BAND_REACH_PX = 60;
const EDGE_OUTWARD_REACH_PX = 80;

export function useKanbanBoardAutoScroll<T extends HTMLElement>(
  boardRef: RefObject<T | null>,
  pageId: string,
): void {
  useEffect(() => {
    const element = boardRef.current;
    if (!element) return;

    const canScroll = ({ source }: { source: { data: Record<string, unknown> } }) =>
      (source.data?.type === KANBAN_CARD_DRAG_TYPE ||
        source.data?.type === KANBAN_COLUMN_DRAG_TYPE) &&
      source.data?.pageId === pageId;

    return combine(
      autoScrollForElements({
        element,
        canScroll,
        getAllowedAxis: () => "horizontal" as const,
      }),
      unsafeOverflowAutoScrollForElements({
        element,
        canScroll,
        getAllowedAxis: () => "horizontal" as const,
        getOverflow: () => ({
          forLeftEdge: { left: EDGE_OUTWARD_REACH_PX, top: HEADER_BAND_REACH_PX },
          forRightEdge: { right: EDGE_OUTWARD_REACH_PX, top: HEADER_BAND_REACH_PX },
        }),
      }),
    );
  }, [boardRef, pageId]);
}

export function useKanbanColumnAutoScroll<T extends HTMLElement>(
  listRef: RefObject<T | null>,
  pageId: string,
): void {
  useEffect(() => {
    const element = listRef.current;
    if (!element) return;

    const canScroll = ({ source }: { source: { data: Record<string, unknown> } }) =>
      source.data?.type === KANBAN_CARD_DRAG_TYPE && source.data?.pageId === pageId;

    return combine(
      autoScrollForElements({
        element,
        canScroll,
        getAllowedAxis: () => "vertical" as const,
      }),
      unsafeOverflowAutoScrollForElements({
        element,
        canScroll,
        getAllowedAxis: () => "vertical" as const,
        getOverflow: () => ({
          forTopEdge: { top: EDGE_OUTWARD_REACH_PX },
          forBottomEdge: { bottom: EDGE_OUTWARD_REACH_PX },
        }),
      }),
    );
  }, [listRef, pageId]);
}
