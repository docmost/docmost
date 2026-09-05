import "@fontsource-variable/inter";
import "@/styles/public-typography.css";
import { useEffect, useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useGetSharedPageTreeQuery } from "@/features/share/queries/share-query.ts";
import { buildSharedPageTree } from "@/features/share/utils.ts";
import {
  sharedPageTreeAtom,
  sharedTreeDataAtom,
} from "@/features/share/atoms/shared-page-atom.ts";
import DocsShell from "@/features/public-space/components/docs/docs-shell.tsx";
import { DocsSurface } from "@/features/public-space/components/docs/docs-surface-context.tsx";
import { useDocsAccent } from "@/features/public-space/theme/docs-theme.ts";
import { buildSharedPageUrl } from "@/features/page/page.utils.ts";
import { ShareSearchSpotlight } from "@/features/search/components/share-search-spotlight.tsx";
import { shareSearchSpotlight } from "@/features/search/constants";

export default function ShareLayout() {
  const { shareId } = useParams();
  const { data } = useGetSharedPageTreeQuery(shareId);

  // Shares have no appearance settings; apply the default docs accent.
  useDocsAccent(undefined);

  const setSharedPageTree = useSetAtom(sharedPageTreeAtom);
  const setSharedTreeData = useSetAtom(sharedTreeDataAtom);

  const treeData = useMemo(() => {
    if (!data?.pageTree) return null;
    return buildSharedPageTree(data.pageTree);
  }, [data?.pageTree]);

  useEffect(() => {
    setSharedPageTree(data || null);
    setSharedTreeData(treeData);
  }, [data, treeData, setSharedPageTree, setSharedTreeData]);

  const surface = useMemo<DocsSurface>(
    () => ({
      treeData,
      hasSidebar: (data?.pageTree?.length ?? 0) > 1,
      getNodeUrl: (node) =>
        buildSharedPageUrl({
          shareId,
          pageSlugId: node.slugId,
          pageTitle: node.name,
        }),
      showBranding: Boolean(data),
      showEditPage: true,
      brandingRef: "public-share",
    }),
    [data, treeData, shareId],
  );

  return (
    <DocsShell
      surface={surface}
      onSearchOpen={shareId ? shareSearchSpotlight.open : undefined}
      searchSpotlight={
        shareId ? <ShareSearchSpotlight shareId={shareId} /> : undefined
      }
    >
      <Outlet />
    </DocsShell>
  );
}
