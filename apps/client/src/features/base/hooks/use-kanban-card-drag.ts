import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

export type CardDragData = {
  type: "base-kanban-card";
  cardId: string;
  columnKey: string;
};

export type CardDropPayload = {
  draggedCardId: string;
  targetCardId: string;
  edge: Edge;
  sourceColumnKey: string;
  targetColumnKey: string;
};

export function useKanbanCardDrag({
  cardId,
  columnKey,
  onDrop,
  sortsActive,
  disabled,
}: {
  cardId: string;
  columnKey: string;
  onDrop: (payload: CardDropPayload) => void;
  sortsActive: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  // Keep onDrop fresh without re-registering the effect each render.
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const data: CardDragData = {
      type: "base-kanban-card",
      cardId,
      columnKey,
    };
    return combine(
      draggable({
        element: el,
        getInitialData: () => data,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => {
          if (source.data.type !== "base-kanban-card") return false;
          if (source.data.cardId === cardId) return false;
          // Block intra-column drops when a sort is active (the slot would
          // visibly snap back to the sort's chosen position, confusing the
          // user). Cross-column drops still work and change the cell value.
          if (sortsActive && source.data.columnKey === columnKey) return false;
          return true;
        },
        getData: ({ input, element }) =>
          attachClosestEdge(
            { type: "base-kanban-card-target", cardId, columnKey },
            { input, element, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ source, self }) => {
          setClosestEdge(null);
          if (source.data.type !== "base-kanban-card") return;
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          onDropRef.current({
            draggedCardId: source.data.cardId as string,
            targetCardId: cardId,
            edge,
            sourceColumnKey: source.data.columnKey as string,
            targetColumnKey: columnKey,
          });
        },
      }),
    );
  }, [cardId, columnKey, disabled, sortsActive]);

  return { ref, isDragging, closestEdge };
}
