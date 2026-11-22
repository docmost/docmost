import { NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import { SegmentedControl, Skeleton } from "@mantine/core";
import { useId, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import type { SubpagesSortBy } from "@docmost/editor-ext";
import { publicSpaceTreeDataAtom } from "@/features/public-space/atoms/public-space-atoms.ts";
import { extractPageSlugId } from "@/lib";
import SubpageItem from "./subpage-item";
import { useSubpages } from "./use-subpages";
import {
  PageListLayout,
  PageListRefreshButton,
} from "../common/page-list-layout";
import listStyles from "../common/page-list.module.css";
import classes from "./subpages.module.css";

export default function SubpagesView(props: NodeViewProps) {
  const { editor, node, extension, updateAttributes } = props;
  const rootSpaceId: string | undefined = extension.options.rootSpaceId;
  const { spaceSlug, shareId, pageSlug } = useParams();
  const { t } = useTranslation();
  const location = useLocation();
  const headingId = useId();
  const expandedBranches = useRef(new Set<() => Promise<unknown>>()).current;
  const [refreshing, setRefreshing] = useState(false);
  const isShareRoute = location.pathname.startsWith("/share/");
  const isPublicSpaceRoute = location.pathname.startsWith("/docs/");
  const isPublicView = isShareRoute || isPublicSpaceRoute;
  const isEditable = useEditorState({
    editor,
    selector: (ctx) => ctx.editor.isEditable,
  });

  const publicSpaceTreeData = useAtomValue(publicSpaceTreeDataAtom);

  // @ts-ignore
  const storagePageId = editor.storage.pageId;
  const routePageId = extractPageSlugId(pageSlug);
  let currentPageId = storagePageId;

  if (isShareRoute) {
    currentPageId = routePageId;
  }

  // Public docs must resolve the page from the route, not editor storage:
  // storage.pageId is set after this view's first render and is not reactive,
  // which froze the list at "No subpages" until something re-rendered it. The
  // space home renders at the bare URL, so it falls back to the first root.
  if (isPublicSpaceRoute) {
    currentPageId = routePageId ?? publicSpaceTreeData?.[0]?.slugId;
  }

  const sortBy: SubpagesSortBy = node.attrs.sortBy || "default";
  const { subpages, isLoading, error, refetch } = useSubpages(
    rootSpaceId ? { spaceId: rootSpaceId } : { pageId: currentPageId },
    sortBy,
  );
  const copy = rootSpaceId
    ? {
        heading: t("Pages"),
        refresh: t("Refresh space pages"),
        empty: t("No pages"),
        error: t("Failed to load space pages"),
      }
    : {
        heading: t("Subpages"),
        refresh: t("Refresh subpages"),
        empty: t("No subpages"),
        error: t("Failed to load subpages"),
      };

  async function refreshSubpages() {
    if (!refetch) return;
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        ...Array.from(expandedBranches, (reload) => reload()),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <NodeViewWrapper
      data-drag-handle
      data-type="subpages"
      contentEditable={false}
      className={listStyles.block + " " + classes.block}
    >
      <PageListLayout
        headingId={headingId}
        heading={copy.heading}
        actions={
          refetch && (
            <>
              {isEditable && subpages.length > 1 && (
                <SegmentedControl<SubpagesSortBy>
                  size="xs"
                  className={classes.sortControl}
                  value={sortBy}
                  onChange={(value) => {
                    if (editor.isEditable) updateAttributes({ sortBy: value });
                  }}
                  data={[
                    { label: t("Manual"), value: "default" },
                    { label: t("A–Z"), value: "title-asc" },
                    { label: t("Recent"), value: "recent" },
                  ]}
                  aria-label={t("Sort subpages")}
                />
              )}
              <PageListRefreshButton
                label={copy.refresh}
                loading={isLoading || refreshing}
                onClick={refreshSubpages}
              />
            </>
          )
        }
      >
        {isLoading ? (
          <Skeleton h={32} m="xs" />
        ) : subpages.length > 0 ? (
          <div role="list" aria-labelledby={headingId}>
            {subpages.map((page) => (
              <SubpageItem
                key={page.id}
                page={page}
                depth={0}
                sortBy={sortBy}
                expandedBranches={expandedBranches}
                showUpdatedAt={!isPublicView}
                isPublicSpaceRoute={isPublicSpaceRoute}
                shareId={shareId}
                spaceSlug={spaceSlug}
                loadAll={!!rootSpaceId}
              />
            ))}
          </div>
        ) : (
          <div className={listStyles.empty}>
            {error ? copy.error : copy.empty}
          </div>
        )}
      </PageListLayout>
    </NodeViewWrapper>
  );
}
