import { useEffect, useRef, useCallback } from "react";
import { Table } from "@tanstack/react-table";
import { IBaseRow } from "@/features/base/types/base.types";

export function useColumnResize(
  table: Table<IBaseRow>,
  onResizeEnd: () => void,
) {
  const wasResizingRef = useRef(false);

  const checkResizeEnd = useCallback(() => {
    const isResizing = table.getState().columnSizingInfo.isResizingColumn;
    if (wasResizingRef.current && !isResizing) {
      onResizeEnd();
    }
    wasResizingRef.current = !!isResizing;
  }, [table, onResizeEnd]);

  useEffect(() => {
    checkResizeEnd();
  });

  return {
    isResizing: !!table.getState().columnSizingInfo.isResizingColumn,
  };
}
