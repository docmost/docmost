import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useDocsSurface } from "@/features/public-space/components/docs/docs-surface-context.tsx";
import { flattenTreePreorder } from "@/features/public-space/utils/docs-tree.ts";
import { extractPageSlugId } from "@/lib";
import { SharedPageTreeNode } from "@/features/share/utils.ts";

export function useDocsCurrentPage(): SharedPageTreeNode | null {
  const { pageSlug } = useParams();
  const { treeData } = useDocsSurface();

  return useMemo(() => {
    if (!treeData?.length) return null;
    const currentSlugId = pageSlug
      ? extractPageSlugId(pageSlug)
      : treeData[0]?.slugId;
    return (
      flattenTreePreorder(treeData).find(
        (node) => node.slugId === currentSlugId,
      ) ?? null
    );
  }, [treeData, pageSlug]);
}
