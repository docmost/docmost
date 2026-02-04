import { useAtomValue } from "jotai";
import { RefObject, useCallback, useEffect, useState } from "react";
import { diffCountsAtom } from "@/features/page-history/atoms/history-atoms";

/**
 * Manages navigation between diff changes in the history view.
 * Provides prev/next handlers and auto-scrolls to the current change.
 */
export function useDiffNavigation(
  scrollViewportRef: RefObject<HTMLDivElement>,
) {
  const diffCounts = useAtomValue(diffCountsAtom);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);

  const scrollToChangeIndex = useCallback(
    (index: number) => {
      const viewport = scrollViewportRef.current;
      if (!viewport || index < 1) return;

      const element = viewport.querySelector(`[data-diff-index="${index}"]`);
      if (element instanceof HTMLElement) {
        const elementTop = element.offsetTop;
        const viewportHeight = viewport.clientHeight;
        const scrollTarget =
          elementTop - viewportHeight / 2 + element.offsetHeight / 2;
        viewport.scrollTo({ top: scrollTarget, behavior: "smooth" });
      }
    },
    [scrollViewportRef],
  );

  useEffect(() => {
    if (diffCounts && diffCounts.total > 0) {
      setCurrentChangeIndex(1);
      requestAnimationFrame(() => scrollToChangeIndex(1));
    } else {
      setCurrentChangeIndex(0);
    }
  }, [diffCounts, scrollToChangeIndex]);

  const handlePrevChange = useCallback(() => {
    if (!diffCounts || diffCounts.total === 0) return;
    const newIndex =
      currentChangeIndex <= 1 ? diffCounts.total : currentChangeIndex - 1;
    setCurrentChangeIndex(newIndex);
    scrollToChangeIndex(newIndex);
  }, [diffCounts, currentChangeIndex, scrollToChangeIndex]);

  const handleNextChange = useCallback(() => {
    if (!diffCounts || diffCounts.total === 0) return;
    const newIndex =
      currentChangeIndex >= diffCounts.total ? 1 : currentChangeIndex + 1;
    setCurrentChangeIndex(newIndex);
    scrollToChangeIndex(newIndex);
  }, [diffCounts, currentChangeIndex, scrollToChangeIndex]);

  return { currentChangeIndex, handlePrevChange, handleNextChange };
}
