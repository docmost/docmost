import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { sharedTreeDataAtom } from "@/features/share/atoms/shared-page-atom";
import { findSubpagesInTree } from "@/features/share/utils";

export function useSharedPageSubpages(pageId: string | undefined) {
  const treeData = useAtomValue(sharedTreeDataAtom);

  return useMemo(
    () => findSubpagesInTree(treeData, pageId),
    [treeData, pageId],
  );
}
