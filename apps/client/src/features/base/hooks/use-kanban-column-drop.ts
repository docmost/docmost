import { useEffect, useRef, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { CardDropPayload } from "./use-kanban-card-drag";

export const COLUMN_BODY_TARGET_ID = "__column-body__";

export function useKanbanColumnDrop({
  columnKey,
  onDrop,
}: {
  columnKey: string;
  onDrop: (payload: CardDropPayload) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOver, setIsOver] = useState(false);
  // Keep onDrop fresh without re-registering the effect each render.
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === "base-kanban-card",
      getIsSticky: () => true,
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: ({ source }) => {
        setIsOver(false);
        if (source.data.type !== "base-kanban-card") return;
        // If a card-level target inside this column already handled the
        // drop, Pragmatic-dnd only invokes the innermost matching target,
        // so this column-body handler won't fire. When it does fire, the
        // user missed every card — append to the column.
        onDropRef.current({
          draggedCardId: source.data.cardId as string,
          targetCardId: COLUMN_BODY_TARGET_ID,
          edge: "bottom",
          sourceColumnKey: source.data.columnKey as string,
          targetColumnKey: columnKey,
        });
      },
    });
  }, [columnKey]);

  return { ref, isOver };
}
