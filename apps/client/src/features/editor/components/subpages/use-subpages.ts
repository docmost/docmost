import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";
import type { SubpagesSortBy } from "@docmost/editor-ext";
import { useGetSidebarPagesQuery } from "@/features/page/queries/page-query";
import { sharedTreeDataAtom } from "@/features/share/atoms/shared-page-atom";
import { publicSpaceTreeDataAtom } from "@/features/public-space/atoms/public-space-atoms.ts";
import { findSubpagesInTree } from "@/features/share/utils";
import { sortSubpages } from "./subpages.utils";

export function useSubpages(
  pageId: string | undefined,
  sortBy: SubpagesSortBy,
  enabled = true,
) {
  const { pathname } = useLocation();
  const isShareRoute = pathname.startsWith("/share/");
  const isPublicView = isShareRoute || pathname.startsWith("/docs/");

  const sharedTreeData = useAtomValue(sharedTreeDataAtom);
  const publicSpaceTreeData = useAtomValue(publicSpaceTreeDataAtom);

  const { data, isLoading, error } = useGetSidebarPagesQuery(
    !isPublicView && enabled ? { pageId } : null,
  );

  const subpages = useMemo(() => {
    if (isPublicView) {
      const tree = isShareRoute ? sharedTreeData : publicSpaceTreeData;
      const nodes = findSubpagesInTree(tree, pageId).map((node) => ({
        id: node.value,
        slugId: node.slugId,
        title: node.name,
        icon: node.icon,
        position: node.position,
        hasChildren: node.hasChildren,
        updatedAt: node.updatedAt,
      }));
      return sortSubpages(nodes, sortBy);
    }

    const pages = data?.pages.flatMap((page) => page.items) ?? [];
    return sortSubpages(pages, sortBy);
  }, [
    isPublicView,
    isShareRoute,
    sharedTreeData,
    publicSpaceTreeData,
    pageId,
    data,
    sortBy,
  ]);

  return { subpages, isLoading, error };
}
