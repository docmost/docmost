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

export type ColumnReorderPayload = {
  draggedColumnKey: string;
  targetColumnKey: string;
  edge: Edge;
};

export function useKanbanColumnReorder({
  columnKey,
  onDrop,
}: {
  columnKey: string;
  onDrop: (payload: ColumnReorderPayload) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  // Keep onDrop fresh without re-registering the effect each render.
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return combine(
      draggable({
        element: el,
        canDrag: ({ input }) => {
          // Don't start a drag when the user is interacting with a marked
          // "no-drag" subtree (e.g. the column header's menu trigger).
          const target = document.elementFromPoint(
            input.clientX,
            input.clientY,
          ) as HTMLElement | null;
          if (target?.closest("[data-no-drag]")) return false;
          return true;
        },
        getInitialData: () => ({ type: "base-kanban-column", columnKey }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) =>
          source.data.type === "base-kanban-column" &&
          source.data.columnKey !== columnKey,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { type: "base-kanban-column-target", columnKey },
            { input, element, allowedEdges: ["left", "right"] },
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ source, self }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge || source.data.type !== "base-kanban-column") return;
          onDropRef.current({
            draggedColumnKey: source.data.columnKey as string,
            targetColumnKey: columnKey,
            edge,
          });
        },
      }),
    );
  }, [columnKey]);

  return { ref, isDragging, closestEdge };
}
