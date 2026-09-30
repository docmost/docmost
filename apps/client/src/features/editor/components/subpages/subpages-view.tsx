import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Stack, Text } from "@mantine/core";
import { useGetSidebarPagesQuery } from "@/features/page/queries/page-query";
import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import classes from "./subpages.module.css";
import { useTranslation } from "react-i18next";
import { useSharedPageSubpages } from "@/features/share/hooks/use-shared-page-subpages";
import { useAtomValue } from "jotai";
import { publicSpaceTreeDataAtom } from "@/features/public-space/atoms/public-space-atoms.ts";
import { findSubpagesInTree } from "@/features/share/utils";
import { extractPageSlugId } from "@/lib";
import SubpageItem from "./subpage-item";
import {
  sortSubpages,
  type SubpageListItem,
  type SubpagesSortBy,
} from "./subpages.utils";

export default function SubpagesView(props: NodeViewProps) {
  const { editor } = props;
  const { spaceSlug, shareId, pageSlug } = useParams();
  const { t } = useTranslation();
  const location = useLocation();
  const isPublicSpaceRoute = location.pathname.startsWith("/docs/");

  const publicSpaceTreeData = useAtomValue(publicSpaceTreeDataAtom);

  // @ts-ignore
  const storagePageId = editor.storage.pageId;
  const routePageId = extractPageSlugId(pageSlug);
  let currentPageId = storagePageId;

  if (shareId){
    currentPageId = routePageId;
  }

  // Public docs must resolve the page from the route, not editor storage:
  // storage.pageId is set after this view's first render and is not reactive,
  // which froze the list at "No subpages" until something re-rendered it. The
  // space home renders at the bare URL, so it falls back to the first root.
  if (isPublicSpaceRoute) {
    currentPageId = routePageId ?? publicSpaceTreeData?.[0]?.slugId;
  }
  const sortBy = (props.node.attrs.sortBy || "position") as SubpagesSortBy;

  // Get subpages from shared tree if we're in a shared context
  const sharedSubpages = useSharedPageSubpages(currentPageId);
  const publicSpaceSubpages = useMemo(
    () => findSubpagesInTree(publicSpaceTreeData, currentPageId),
    [publicSpaceTreeData, currentPageId],
  );

  const isPublicView = Boolean(shareId) || isPublicSpaceRoute;

  const { data, isLoading, error } = useGetSidebarPagesQuery(
    isPublicView ? null : { pageId: currentPageId },
  );

  const subpages = useMemo(() => {
    // If we're in a shared context, use the shared subpages
    if (shareId && sharedSubpages) {
      return sortSubpages(sharedSubpages.map((node) => ({
        id: node.value,
        slugId: node.slugId,
        title: node.name,
        icon: node.icon,
        position: node.position,
        hasChildren: node.hasChildren,
      })), sortBy);
    }

    if (isPublicSpaceRoute) {
      return publicSpaceSubpages.map((node) => ({
        id: node.value,
        slugId: node.slugId,
        title: node.name,
        icon: node.icon,
        position: node.position,
      }));
    }

    // Otherwise use the API data
    if (!data?.pages) return [];
    const allPages = data.pages.flatMap((page) => page.items);
    return sortSubpages(allPages, sortBy);
  }, [data, shareId, sharedSubpages, isPublicSpaceRoute, publicSpaceSubpages, sortBy]);

  if (isLoading && !isPublicView) {
    return null;
  }

  if (error && !isPublicView) {
    return (
      <NodeViewWrapper data-drag-handle>
        <Text c="dimmed" size="md" py="md">
          {t("Failed to load subpages")}
        </Text>
      </NodeViewWrapper>
    );
  }

  if (subpages.length === 0) {
    return (
      <NodeViewWrapper data-drag-handle>
        <div className={classes.container}>
          <Text c="dimmed" size="md" py="md">
            {t("No subpages")}
          </Text>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-drag-handle>
      <div className={classes.container}>
        <Stack gap={5} >
          {subpages.map((page: SubpageListItem) => (
            <SubpageItem
              key={page.id}
              page={page}
              depth={0}
              sortBy={sortBy}
              shareId={shareId}
              spaceSlug={spaceSlug}
              isPublicSpaceRoute={isPublicSpaceRoute}
            />
          ))}
        </Stack>
      </div>
    </NodeViewWrapper>
  );
}
