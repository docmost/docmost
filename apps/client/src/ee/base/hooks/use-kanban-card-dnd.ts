import { type RefObject, useEffect, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { KANBAN_CARD_DRAG_TYPE } from "@/ee/base/types/base.types";
import classes from "@/ee/base/styles/kanban.module.css";

export function useKanbanCardDnd({
  cardRef,
  rowId,
  columnKey,
  pageId,
}: {
  cardRef: RefObject<HTMLDivElement | null>;
  rowId: string;
  columnKey: string;
  pageId: string;
}): { closestEdge: Edge | null; isDragging: boolean } {
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl) return;
    return combine(
      draggable({
        element: cardEl,
        getInitialData: () => ({
          type: KANBAN_CARD_DRAG_TYPE,
          rowId,
          columnKey,
          pageId,
        }),
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          const width = cardEl.getBoundingClientRect().width;
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({ x: "12px", y: "8px" }),
            render: ({ container }) => {
              const card = document.createElement("div");
              card.className = classes.cardDragPreview;
              card.style.width = `${width}px`;
              const clone = cardEl.cloneNode(true) as HTMLElement;
              clone.style.opacity = "1";
              card.appendChild(clone);
              container.appendChild(card);
            },
          });
        },
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: cardEl,
        canDrop: ({ source }) =>
          source.data.type === KANBAN_CARD_DRAG_TYPE &&
          source.data.pageId === pageId,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { rowId, columnKey },
            { input, element, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      }),
    );
  }, [cardRef, rowId, columnKey, pageId]);

  return { closestEdge, isDragging };
}
