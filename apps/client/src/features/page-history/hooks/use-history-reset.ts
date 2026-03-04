import { useAtom } from "jotai";
import { useEffect } from "react";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
  diffCountsAtom,
} from "@/features/page-history/atoms/history-atoms";

/**
 * Resets history state when pageId changes.
 * Clears active selection and diff counts.
 */
export function useHistoryReset(pageId: string) {
  const [, setActiveHistoryId] = useAtom(activeHistoryIdAtom);
  const [, setActiveHistoryPrevId] = useAtom(activeHistoryPrevIdAtom);
  const [, setDiffCounts] = useAtom(diffCountsAtom);

  useEffect(() => {
    setActiveHistoryId("");
    setActiveHistoryPrevId("");
    // @ts-ignore
    setDiffCounts(null);
  }, [pageId, setActiveHistoryId, setActiveHistoryPrevId, setDiffCounts]);
}
