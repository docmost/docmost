import { useState, useRef, useCallback } from "react";

export function usePaginateAndSearch(initialQuery: string = "") {
  const [search, setSearch] = useState(initialQuery);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const prevSearchRef = useRef(search);

  const handleSearch = useCallback((newQuery: string) => {
    if (prevSearchRef.current !== newQuery) {
      prevSearchRef.current = newQuery;
      setSearch(newQuery);
      setCursor(undefined);
      setCursorStack([]);
    }
  }, []);

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

  return { search, cursor, goNext, goPrev, handleSearch };
}
