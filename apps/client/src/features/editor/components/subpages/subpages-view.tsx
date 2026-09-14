import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Stack, Text, Anchor, ActionIcon } from "@mantine/core";
import { IconFileDescription } from "@tabler/icons-react";
import { useGetSidebarPagesQuery } from "@/features/page/queries/page-query";
import { useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import classes from "./subpages.module.css";
import styles from "../mention/mention.module.css";
import {
  buildPageUrl,
  buildPublicSpaceUrl,
  buildSharedPageUrl,
} from "@/features/page/page.utils.ts";
import { useTranslation } from "react-i18next";
import { sortPositionKeys } from "@/features/page/tree/utils/utils";
import { useSharedPageSubpages } from "@/features/share/hooks/use-shared-page-subpages";
import { useAtomValue } from "jotai";
import { publicSpaceTreeDataAtom } from "@/features/public-space/atoms/public-space-atoms.ts";
import { findSubpagesInTree } from "@/features/share/utils";
import { extractPageSlugId } from "@/lib";

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
      return sharedSubpages.map((node) => ({
        id: node.value,
        slugId: node.slugId,
        title: node.name,
        icon: node.icon,
        position: node.position,
      }));
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
    return sortPositionKeys(allPages);
  }, [
    data,
    shareId,
    sharedSubpages,
    isPublicSpaceRoute,
    publicSpaceSubpages,
  ]);

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
        <Stack gap={5}>
          {subpages.map((page) => (
            <Anchor
              key={page.id}
              component={Link}
              fw={500}
              to={
                shareId
                  ? buildSharedPageUrl({
                      shareId,
                      pageSlugId: page.slugId,
                      pageTitle: page.title,
                    })
                  : isPublicSpaceRoute
                    ? buildPublicSpaceUrl({
                        spaceSlug,
                        pageSlugId: page.slugId,
                        pageTitle: page.title,
                      })
                    : buildPageUrl(spaceSlug, page.slugId, page.title)
              }
              underline="never"
              className={styles.pageMentionLink}
              draggable={false}
            >
              {page?.icon ? (
                <span style={{ marginRight: "4px" }}>{page.icon}</span>
              ) : (
                <ActionIcon
                  variant="transparent"
                  color="gray"
                  component="span"
                  size={18}
                  style={{ verticalAlign: "text-bottom" }}
                >
                  <IconFileDescription size={18} />
                </ActionIcon>
              )}

              <span className={styles.pageMentionText}>
                {page?.title || t("untitled")}
              </span>
            </Anchor>
          ))}
        </Stack>
      </div>
    </NodeViewWrapper>
  );
}
