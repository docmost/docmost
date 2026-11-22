import { createContext } from "react";

// Only private editor surfaces opt in to looking up pages for the current viewer.
export const PagesByLabelContext = createContext<{
  pageId?: string;
  spaceId?: string | null;
} | null>(null);
