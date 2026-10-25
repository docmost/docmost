import { NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import { SegmentedControl } from "@mantine/core";
import { useId } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import type { SubpagesSortBy } from "@docmost/editor-ext";
import { publicSpaceTreeDataAtom } from "@/features/public-space/atoms/public-space-atoms.ts";
import { extractPageSlugId } from "@/lib";
import SubpageItem from "./subpage-item";
import { useSubpages } from "./use-subpages";
import classes from "./subpages.module.css";

export default function SubpagesView(props: NodeViewProps) {
  const { editor, node, updateAttributes } = props;
  const { spaceSlug, shareId, pageSlug } = useParams();
  const { t } = useTranslation();
  const location = useLocation();
  const headingId = useId();
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

  if (isShareRoute){
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
  const { subpages, isLoading, error } = useSubpages(currentPageId, sortBy);

  if (isLoading) {
    return null;
  }

  return (
    <NodeViewWrapper data-drag-handle>
      <div className={classes.card}>
        <div className={classes.header}>
          <div id={headingId} className={classes.heading}>
            {t("Subpages")}
            {subpages.length > 0 && (
              <span className={classes.count}>{subpages.length}</span>
            )}
          </div>

          {isEditable && subpages.length > 1 && (
            <SegmentedControl<SubpagesSortBy>
              size="xs"
              className={classes.sortControl}
              value={sortBy}
              onChange={(value) => updateAttributes({ sortBy: value })}
              data={[
                { label: t("Manual"), value: "default" },
                { label: t("A–Z"), value: "title-asc" },
                { label: t("Recent"), value: "recent" },
              ]}
              aria-label={t("Sort subpages")}
            />
          )}
        </div>

        {subpages.length > 0 ? (
          <div role="list" aria-labelledby={headingId} className={classes.list}>
            {subpages.map((page) => (
              <SubpageItem
                key={page.id}
                page={page}
                depth={0}
                sortBy={sortBy}
                showUpdatedAt={!isPublicView}
                isPublicSpaceRoute={isPublicSpaceRoute}
                shareId={shareId}
                spaceSlug={spaceSlug}
              />
            ))}
          </div>
        ) : (
          <div className={classes.empty}>
            {error ? t("Failed to load subpages") : t("No subpages")}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
