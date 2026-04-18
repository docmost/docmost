import { useCallback } from "react";
import { useAtom } from "jotai";
import {
  selectedRowIdsAtom,
  lastToggledRowIndexAtom,
} from "@/features/base/atoms/base-atoms";

type ToggleOpts = {
  shiftKey: boolean;
  rowIndex: number;
  orderedRowIds: string[];
};

export function useRowSelection() {
  const [selectedIds, setSelectedIds] = useAtom(selectedRowIdsAtom) as unknown as [
    Set<string>,
    (val: Set<string> | ((prev: Set<string>) => Set<string>)) => void,
  ];
  const [lastToggledIndex, setLastToggledIndex] = useAtom(
    lastToggledRowIndexAtom,
  ) as unknown as [number | null, (val: number | null) => void];

  const isSelected = useCallback(
    (rowId: string) => selectedIds.has(rowId),
    [selectedIds],
  );

  const toggle = useCallback(
    (rowId: string, opts: ToggleOpts) => {
      const { shiftKey, rowIndex, orderedRowIds } = opts;
      const next = new Set(selectedIds);

      if (shiftKey && lastToggledIndex !== null && lastToggledIndex !== rowIndex) {
        const start = Math.min(lastToggledIndex, rowIndex);
        const end = Math.max(lastToggledIndex, rowIndex);
        const anchorId = orderedRowIds[lastToggledIndex];
        const turnOn = anchorId ? next.has(anchorId) : true;
        for (let i = start; i <= end; i += 1) {
          const id = orderedRowIds[i];
          if (!id) continue;
          if (turnOn) next.add(id);
          else next.delete(id);
        }
      } else {
        if (next.has(rowId)) next.delete(rowId);
        else next.add(rowId);
      }

      setSelectedIds(next);
      setLastToggledIndex(rowIndex);
    },
    [selectedIds, lastToggledIndex, setSelectedIds, setLastToggledIndex],
  );

  const toggleAll = useCallback(
    (loadedRowIds: string[]) => {
      if (loadedRowIds.length === 0) return;
      const allSelected = loadedRowIds.every((id) => selectedIds.has(id));
      if (allSelected) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(loadedRowIds));
      }
      setLastToggledIndex(null);
    },
    [selectedIds, setSelectedIds, setLastToggledIndex],
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    setLastToggledIndex(null);
  }, [setSelectedIds, setLastToggledIndex]);

  const removeIds = useCallback(
    (rowIds: string[]) => {
      if (rowIds.length === 0) return;
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        let changed = false;
        const next = new Set(prev);
        for (const id of rowIds) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    },
    [setSelectedIds],
  );

  return {
    selectedIds,
    selectionCount: selectedIds.size,
    isSelected,
    toggle,
    toggleAll,
    clear,
    removeIds,
  };
}
