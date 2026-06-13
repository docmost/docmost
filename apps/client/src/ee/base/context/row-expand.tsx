import { createContext, useContext } from "react";

// Rows only need the handler at click time; a stable context value keeps the
// expand affordance out of every GridRow/GridCell memo equality check.
const RowExpandContext = createContext<((rowId: string) => void) | null>(null);

export const RowExpandProvider = RowExpandContext.Provider;

export function useRowExpand(): ((rowId: string) => void) | null {
  return useContext(RowExpandContext);
}
