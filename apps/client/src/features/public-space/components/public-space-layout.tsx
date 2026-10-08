import "@fontsource-variable/inter";
import "@/styles/public-typography.css";
import { useEffect, useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useSetAtom } from "jotai";
import { usePublicSpaceTreeQuery } from "@/features/public-space/queries/public-space-query.ts";
import { buildSharedPageTree } from "@/features/share/utils.ts";
import {
  publicSpaceTreeAtom,
  publicSpaceTreeDataAtom,
} from "@/features/public-space/atoms/public-space-atoms.ts";
import { useDocsAccent } from "@/features/public-space/theme/docs-theme.ts";
import DocsShell from "@/features/public-space/components/docs/docs-shell.tsx";
import { DocsSurface } from "@/features/public-space/components/docs/docs-surface-context.tsx";
import { buildPublicSpaceUrl } from "@/features/page/page.utils.ts";
import { PublicSpaceSearchSpotlight } from "@/features/search/components/public-space-search-spotlight.tsx";
import { publicSpaceSearchSpotlight } from "@/features/search/constants";

export default function PublicSpaceLayout() {
  const { spaceSlug } = useParams();
  const { data } = usePublicSpaceTreeQuery(spaceSlug);

  useDocsAccent(data?.appearance);

  const setPublicSpaceTree = useSetAtom(publicSpaceTreeAtom);
  const setPublicSpaceTreeData = useSetAtom(publicSpaceTreeDataAtom);

  const treeData = useMemo(() => {
    if (!data?.pageTree) return null;
    return buildSharedPageTree(data.pageTree);
  }, [data?.pageTree]);

  useEffect(() => {
    setPublicSpaceTree(data || null);
    setPublicSpaceTreeData(treeData);
  }, [data, treeData, setPublicSpaceTree, setPublicSpaceTreeData]);

  const surface = useMemo<DocsSurface>(() => {
    const homeUrl = buildPublicSpaceUrl({ spaceSlug });
    // The first root page is the space home, served at the bare space URL.
    const firstRootSlugId = treeData?.[0]?.slugId;
    return {
      treeData,
      hasSidebar: (data?.pageTree?.length ?? 0) > 1,
      siteName: data?.space?.name,
      homeUrl,
      getNodeUrl: (node) =>
        node.slugId === firstRootSlugId
          ? homeUrl
          : buildPublicSpaceUrl({
              spaceSlug,
              pageSlugId: node.slugId,
              pageTitle: node.name,
            }),
      showBranding: Boolean(data),
      showEditPage: true,
    };
  }, [data, treeData, spaceSlug]);

  return (
    <DocsShell
      surface={surface}
      onSearchOpen={publicSpaceSearchSpotlight.open}
      searchSpotlight={<PublicSpaceSearchSpotlight spaceSlug={spaceSlug} />}
    >
      <Outlet />
    </DocsShell>
  );
}
