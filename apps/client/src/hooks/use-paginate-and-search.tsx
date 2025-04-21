import { useState, useRef, useCallback } from "react";

export function usePaginateAndSearch(initialQuery: string = "") {
  const [search, setSearch] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const prevSearchRef = useRef(search);

  const handleSearch = useCallback((newQuery: string) => {
    if (prevSearchRef.current !== newQuery) {
      prevSearchRef.current = newQuery;
      setSearch(newQuery);
      setPage(1);
    }
  }, []);

  return { search, page, setPage, handleSearch };
}
