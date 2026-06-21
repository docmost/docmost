import { createContext, useContext } from "react";

// Row order is only needed at interaction time (shift-select range math), so
// rows subscribe to a stable getter instead of the array itself — appending a
// page must not re-render every mounted row.
const GridRowOrderContext = createContext<() => string[]>(() => []);

export const GridRowOrderProvider = GridRowOrderContext.Provider;

export function useGridRowOrder(): () => string[] {
  return useContext(GridRowOrderContext);
}
