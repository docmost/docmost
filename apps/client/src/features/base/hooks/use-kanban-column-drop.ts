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
      // Keeps the column highlighted while the cursor passes over inner
      // card drop targets, so the drop affordance doesn't flicker.
      getIsSticky: () => true,
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: ({ source, location }) => {
        setIsOver(false);
        if (source.data.type !== "base-kanban-card") return;
        // Pragmatic-dnd fires onDrop on EVERY matching target in the ancestor
        // chain, not just the innermost. If a card-level target also matched
        // (the user dropped on a specific card, not on empty space below
        // the last card), the card target already dispatched the precise
        // slot — bail so we don't double-fire and clobber its position.
        const hitCardTarget = location.current.dropTargets.some(
          (t) => (t.data as { type?: unknown }).type === "base-kanban-card-target",
        );
        if (hitCardTarget) return;
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
