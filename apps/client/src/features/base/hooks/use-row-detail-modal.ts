import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

const PARAM = "row";

export function useRowDetailModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openRowId = searchParams.get(PARAM);

  const openRow = useCallback(
    (rowId: string) => {
      const next = new URLSearchParams(searchParams);
      next.set(PARAM, rowId);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  const closeRow = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(PARAM);
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  return { openRowId, openRow, closeRow };
}
