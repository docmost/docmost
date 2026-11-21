import React, { createContext, useContext, useMemo } from "react";
import { HtmlBlockScope } from "@/ee/html-block/types/html-block.types";

const HtmlBlockScopeContext = createContext<HtmlBlockScope>({});

export function HtmlBlockScopeProvider({
  shareId,
  spaceSlug,
  preloaded,
  children,
}: HtmlBlockScope & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({ shareId, spaceSlug, preloaded }),
    [shareId, spaceSlug, preloaded],
  );

  return (
    <HtmlBlockScopeContext.Provider value={value}>
      {children}
    </HtmlBlockScopeContext.Provider>
  );
}

export function useHtmlBlockScope(): HtmlBlockScope {
  return useContext(HtmlBlockScopeContext);
}
