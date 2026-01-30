import { useState, useCallback } from "react";

export function useCursorPaginate() {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);

  const goNext = useCallback((nextCursor: string | null | undefined) => {
    if (nextCursor) {
      setCursorStack((prev) => [...prev, cursor]);
      setCursor(nextCursor);
    }
  }, [cursor]);

  const goPrev = useCallback(() => {
    setCursorStack((prev) => {
      const next = prev.slice(0, -1);
      setCursor(prev[prev.length - 1]);
      return next;
    });
  }, []);

  const resetCursor = useCallback(() => {
    setCursor(undefined);
    setCursorStack([]);
  }, []);

  return { cursor, goNext, goPrev, resetCursor };
}
