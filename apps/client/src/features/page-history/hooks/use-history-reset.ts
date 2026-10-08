import { useAtom } from "jotai";
import { useEffect } from "react";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
  compareModeAtom,
  comparePairAtom,
  compareSelectionAtom,
  diffCountsAtom,
} from "@/features/page-history/atoms/history-atoms";

/**
 * Resets history state when pageId changes.
 * Clears active selection, diff counts, and compare state.
 * Compare state also resets on unmount so reopening the modal starts clean.
 */
export function useHistoryReset(pageId: string) {
  const [, setActiveHistoryId] = useAtom(activeHistoryIdAtom);
  const [, setActiveHistoryPrevId] = useAtom(activeHistoryPrevIdAtom);
  const [, setDiffCounts] = useAtom(diffCountsAtom);
  const [, setCompareMode] = useAtom(compareModeAtom);
  const [, setCompareSelection] = useAtom(compareSelectionAtom);
  const [, setComparePair] = useAtom(comparePairAtom);

  useEffect(() => {
    const resetCompare = () => {
      setCompareMode(false);
      setCompareSelection([]);
      setComparePair(null);
    };

    setActiveHistoryId("");
    setActiveHistoryPrevId("");
    setDiffCounts(null);
    resetCompare();

    return resetCompare;
  }, [
    pageId,
    setActiveHistoryId,
    setActiveHistoryPrevId,
    setDiffCounts,
    setCompareMode,
    setCompareSelection,
    setComparePair,
  ]);
}
