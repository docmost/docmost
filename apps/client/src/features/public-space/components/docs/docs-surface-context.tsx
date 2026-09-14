import { createContext, useContext } from "react";
import { SharedPageTreeNode } from "@/features/share/utils.ts";

// What varies between the public surfaces (/docs and /share) rendered by the
// docs shell; every shell component reads this contract instead of a feature.
export type DocsSurface = {
  treeData: SharedPageTreeNode[] | null;
  hasSidebar: boolean;
  siteName?: string;
  homeUrl?: string;
  getNodeUrl: (node: Pick<SharedPageTreeNode, "slugId" | "name">) => string;
  showBranding: boolean;
  showEditPage: boolean;
  brandingRef?: string;
};

const DocsSurfaceContext = createContext<DocsSurface | null>(null);

export const DocsSurfaceProvider = DocsSurfaceContext.Provider;

export function useDocsSurface(): DocsSurface {
  const surface = useContext(DocsSurfaceContext);
  if (!surface) {
    throw new Error("useDocsSurface must be used within DocsShell");
  }
  return surface;
}
