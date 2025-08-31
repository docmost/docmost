import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { sharedTreeDataAtom } from "@/features/share/atoms/shared-page-atom";
import { SharedPageTreeNode } from "@/features/share/utils";

export function useSharedPageSubpages(pageId: string | undefined) {
  const treeData = useAtomValue(sharedTreeDataAtom);

  return useMemo(() => {
    if (!treeData || !pageId) return [];

    function findSubpages(nodes: SharedPageTreeNode[]): SharedPageTreeNode[] {
      for (const node of nodes) {
        if (node.value === pageId || node.slugId === pageId) {
          return node.children || [];
        }
        if (node.children && node.children.length > 0) {
          const subpages = findSubpages(node.children);
          if (subpages.length > 0) {
            return subpages;
          }
        }
      }
      return [];
    }

    return findSubpages(treeData);
  }, [treeData, pageId]);
}
