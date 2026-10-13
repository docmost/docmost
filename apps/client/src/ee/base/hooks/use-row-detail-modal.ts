import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

const PARAM = "row";
const BASE_PARAM = "rowBase";

export function useRowDetailModal(baseId: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rowParam = searchParams.get(PARAM);
  const openRowId =
    rowParam && searchParams.get(BASE_PARAM) === baseId ? rowParam : null;

  const openRow = useCallback(
    (rowId: string, options?: { replace?: boolean }) => {
      const next = new URLSearchParams(searchParams);
      next.set(PARAM, rowId);
      next.set(BASE_PARAM, baseId);
      // Prev/next inside the modal replaces the entry so Back leaves the
      // modal instead of replaying every visited record.
      setSearchParams(next, { replace: options?.replace ?? false });
    },
    [searchParams, setSearchParams, baseId],
  );

  const closeRow = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(PARAM);
    next.delete(BASE_PARAM);
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  return { openRowId, openRow, closeRow };
}
