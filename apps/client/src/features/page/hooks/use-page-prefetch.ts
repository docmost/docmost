import { useCallback, useEffect, useRef } from "react";
import { prefetchPage } from "@/features/page/queries/page-query";

// Moving the pointer across a list should not fetch every row it passes.
const HOVER_DELAY_MS = 150;

export function usePagePrefetch() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const prefetch = useCallback(
    (pageId: string) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        void prefetchPage(pageId);
      }, HOVER_DELAY_MS);
    },
    [cancel],
  );

  useEffect(() => cancel, [cancel]);

  return { prefetch, cancel };
}
