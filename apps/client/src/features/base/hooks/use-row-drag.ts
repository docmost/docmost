import { useState, useCallback, useRef, useEffect } from "react";

type RowDragState = {
  dragRowId: string | null;
  dropTargetRowId: string | null;
  dropPosition: "above" | "below" | null;
};

type UseRowDragOptions = {
  rowIds: string[];
  onReorder: (rowId: string, targetRowId: string, position: "above" | "below") => void;
};

export function useRowDrag({ rowIds, onReorder }: UseRowDragOptions) {
  const [dragState, setDragState] = useState<RowDragState>({
    dragRowId: null,
    dropTargetRowId: null,
    dropPosition: null,
  });

  const dragRowIdRef = useRef<string | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const dropPositionRef = useRef<"above" | "below" | null>(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const handleDragStart = useCallback((rowId: string) => {
    dragRowIdRef.current = rowId;
    dropTargetRef.current = null;
    dropPositionRef.current = null;
    setDragState({
      dragRowId: rowId,
      dropTargetRowId: null,
      dropPosition: null,
    });
  }, []);

  const handleDragOver = useCallback(
    (targetRowId: string, e: React.DragEvent) => {
      e.preventDefault();
      if (!dragRowIdRef.current || dragRowIdRef.current === targetRowId) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position: "above" | "below" = e.clientY < midY ? "above" : "below";

      if (dropTargetRef.current === targetRowId && dropPositionRef.current === position) {
        return;
      }

      dropTargetRef.current = targetRowId;
      dropPositionRef.current = position;

      setDragState({
        dragRowId: dragRowIdRef.current,
        dropTargetRowId: targetRowId,
        dropPosition: position,
      });
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    const dragRowId = dragRowIdRef.current;
    const dropTargetRowId = dropTargetRef.current;
    const dropPosition = dropPositionRef.current;

    if (dragRowId && dropTargetRowId && dropPosition && dragRowId !== dropTargetRowId) {
      onReorderRef.current(dragRowId, dropTargetRowId, dropPosition);
    }

    dragRowIdRef.current = null;
    dropTargetRef.current = null;
    dropPositionRef.current = null;
    setDragState({
      dragRowId: null,
      dropTargetRowId: null,
      dropPosition: null,
    });
  }, []);

  const handleDragLeave = useCallback(() => {
    dropTargetRef.current = null;
    dropPositionRef.current = null;
    setDragState((prev) => ({
      ...prev,
      dropTargetRowId: null,
      dropPosition: null,
    }));
  }, []);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      dragRowIdRef.current = null;
      dropTargetRef.current = null;
      dropPositionRef.current = null;
      setDragState({
        dragRowId: null,
        dropTargetRowId: null,
        dropPosition: null,
      });
    };

    document.addEventListener("dragend", handleGlobalDragEnd);
    return () => document.removeEventListener("dragend", handleGlobalDragEnd);
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragLeave,
  };
}
